import logger from './config/logger';
import { DatabaseService } from './services/database';
import { PostMetricsService } from './services/social/post-metrics.service';
import { NotificationService } from './services/notification';

export class MetricsBot {
  private daysThreshold: number;
  private postMetricsService: PostMetricsService;

  constructor(daysThreshold: number = 2) {
    this.daysThreshold = daysThreshold;
    this.postMetricsService = new PostMetricsService();
  }

  /**
   * Ejecuta el bot de métricas
   */
  async run(): Promise<void> {
    const startTime = Date.now();
    logger.info('🤖 Iniciando Bot de Métricas ITracker');

    try {
      // Buscar posts con métricas antiguas
      logger.info(`Buscando posts con métricas de ${this.daysThreshold} días o más (comparando solo fecha, sin hora)`);
      const postsNeedingUpdate = await DatabaseService.getPostsNeedingUpdate(this.daysThreshold);
      logger.info(`Encontrados ${postsNeedingUpdate.length} posts que necesitan actualización`);

      // Buscar posts sin métricas exitosas
      logger.info('Buscando posts sin métricas exitosas');
      const postsWithoutMetrics = await DatabaseService.getPostsWithoutMetrics();
      logger.info(`Encontrados ${postsWithoutMetrics.length} posts sin métricas`);

      // Combinar todos los posts a procesar
      const allPosts = [...postsNeedingUpdate, ...postsWithoutMetrics];

      if (allPosts.length === 0) {
        logger.info('🎉 No hay posts para procesar');
        return;
      }

      // Enviar notificación de inicio
      await NotificationService.sendBotExecutionReport({
        totalPosts: allPosts.length,
        postsNeedingUpdate: postsNeedingUpdate.length,
        postsWithoutMetrics: postsWithoutMetrics.length,
        status: 'started'
      });

      logger.info(`📝 Encontrados ${allPosts.length} posts para procesar`);
      logger.info(`   - Posts con métricas antiguas: ${postsNeedingUpdate.length}`);
      logger.info(`   - Posts sin métricas: ${postsWithoutMetrics.length}`);

      // Procesar posts
      const results = await this.processPosts(allPosts);

      // Calcular estadísticas
      const successfulUpdates = results.filter(r => r.success).length;
      const failedUpdates = results.filter(r => !r.success).length;

      const processingTime = (Date.now() - startTime) / 1000 / 60; // en minutos

      // Resumen de inserciones en tablas
      logger.info(`📊 RESUMEN DE INSERCIONES:`);
      logger.info(`   📝 post_metrics: ${successfulUpdates > 0 ? '✅ Insertado' : '❌ No insertado'}`);
      logger.info(`   📝 influencer_posts: ${successfulUpdates > 0 ? '✅ Actualizado' : '❌ No actualizado'}`);
      logger.info(`   📝 post_topics: ${successfulUpdates > 0 ? '✅ Insertado' : '❌ No insertado'}`);

      logger.info(`🎉 Proceso completado en ${processingTime.toFixed(2)} minutos`);
      logger.info(`   ✅ Exitosos: ${successfulUpdates}`);
      logger.info(`   ❌ Errores: ${failedUpdates}`);

      // Enviar notificación de finalización
      await NotificationService.sendBotExecutionReport({
        totalPosts: allPosts.length,
        successfulUpdates,
        failedUpdates,
        processingTime,
        status: 'completed'
      });

    } catch (error: any) {
      logger.error('❌ Error en ejecución del bot:', error.message);
      
      // Enviar notificación de error
      await NotificationService.sendErrorAlert(
        `Error en bot de métricas: ${error.message}`,
        'Error de ejecución'
      );
      
      throw error;
    }
  }

  /**
   * Ejecuta el bot una sola vez (para testing)
   */
  async runOnce(): Promise<void> {
    logger.info('🔄 Ejecutando bot una sola vez');
    await this.run();
  }

  /**
   * Procesa una lista de posts
   */
  private async processPosts(posts: any[]): Promise<any[]> {
    const results: any[] = [];

    logger.info(`Actualizando métricas para ${posts.length} posts`);

    // Procesar posts en lotes de 3 para no sobrecargar las APIs
    const batchSize = 3;
    for (let i = 0; i < posts.length; i += batchSize) {
      const batch = posts.slice(i, i + batchSize);
      
      logger.info(`Procesando lote ${Math.floor(i / batchSize) + 1}/${Math.ceil(posts.length / batchSize)}`);

      const batchPromises = batch.map(post => 
        this.processSinglePost(post)
      );

      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          const batchItem = batch[index];
          if (batchItem) {
            logger.error(`Error en lote para post ${batchItem.post_id}:`, result.reason);
            results.push({
              post_id: batchItem.post_id,
              platform: batchItem.platform,
              success: false,
              error: result.reason?.message || 'Error desconocido'
            });
          }
        }
      });

      // Pausa entre lotes para no sobrecargar las APIs
      if (i + batchSize < posts.length) {
        await new Promise(resolve => setTimeout(resolve, 3000)); // 3 segundos
      }
    }

    return results;
  }

  /**
   * Procesa un solo post
   */
  private async processSinglePost(post: any): Promise<any> {
    try {
      logger.info(`Actualizando métricas para post ${post.post_id} (${post.platform})`);

      // Extraer métricas usando el servicio local
      const metricsResult = await this.postMetricsService.extractAndSaveMetrics(
        post.post_id,
        post.post_url,
        post.platform
      );

      if (!metricsResult.success) {
        logger.error(`Error actualizando métricas para post ${post.post_id}:`, metricsResult.error);
        return {
          post_id: post.post_id,
          platform: post.platform,
          success: false,
          error: metricsResult.error
        };
      }

      // Guardar métricas en la base de datos
      await DatabaseService.insertPostMetrics(metricsResult.metrics);

      // Actualizar métricas del influencer post
      await this.postMetricsService.updateInfluencerPostMetrics(post.post_id, metricsResult.metrics);

      logger.info(`✅ Métricas actualizadas exitosamente para post ${post.post_id}`);

      return {
        post_id: post.post_id,
        platform: post.platform,
        success: true,
        new_metrics: metricsResult.metrics
      };

    } catch (error: any) {
      logger.error(`Error procesando post ${post.post_id}:`, error.message);
      logger.error(`Error completo:`, JSON.stringify(error, null, 2));
      return {
        post_id: post.post_id,
        platform: post.platform,
        success: false,
        error: error.message || 'Error desconocido'
      };
    }
  }
} 