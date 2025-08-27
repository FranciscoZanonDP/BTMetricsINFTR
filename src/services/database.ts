import { supabase, supabase2 } from '../config/database';
import logger from '../config/logger';
import { PostWithLatestMetrics } from '../types/database';

export class DatabaseService {
  /**
   * Obtiene posts que necesitan actualización de métricas
   * Busca posts cuyo último registro de métricas tenga más de 7 días
   */
  static async getPostsNeedingUpdate(daysThreshold: number = 7): Promise<PostWithLatestMetrics[]> {
    try {
      logger.info(`Buscando posts con métricas de más de ${daysThreshold} días`);

      const allPosts: PostWithLatestMetrics[] = [];

      // Procesar primera base de datos
      const postsFromDB1 = await this.getPostsNeedingUpdateFromDB(supabase, daysThreshold, 'DB1');
      allPosts.push(...postsFromDB1);

      // Procesar segunda base de datos si está disponible
      if (supabase2) {
        logger.info('Procesando segunda base de datos...');
        const postsFromDB2 = await this.getPostsNeedingUpdateFromDB(supabase2, daysThreshold, 'DB2');
        allPosts.push(...postsFromDB2);
      } else {
        logger.info('Segunda base de datos no configurada, saltando...');
      }

      logger.info(`Total de posts que necesitan actualización: ${allPosts.length}`);
      return allPosts;

    } catch (error) {
      logger.error('Error en getPostsNeedingUpdate:', error);
      throw error;
    }
  }

  /**
   * Obtiene posts que necesitan actualización de una base de datos específica
   */
  private static async getPostsNeedingUpdateFromDB(
    dbClient: any, 
    daysThreshold: number, 
    dbName: string
  ): Promise<PostWithLatestMetrics[]> {
    try {
      logger.info(`Buscando posts en ${dbName} con métricas de más de ${daysThreshold} días`);

      // Consulta usando Supabase directamente sin función RPC
      const { data, error } = await dbClient
        .from('post_metrics')
        .select(`
          post_id,
          platform,
          created_at
        `)
        .eq('api_success', true)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error(`Error consultando post_metrics en ${dbName}:`, error);
        return [];
      }

      // Obtener influencer_posts para hacer el join
      const { data: influencerPosts, error: ipError } = await dbClient
        .from('influencer_posts')
        .select(`
          id,
          post_url,
          platform,
          influencer_id,
          campaign_id
        `)
        .is('deleted_at', null);

      if (ipError) {
        logger.error(`Error consultando influencer_posts en ${dbName}:`, ipError);
        return [];
      }

      // Crear mapa de posts más recientes por post_id
      const latestMetrics = new Map<string, any>();
      data?.forEach((metric: any) => {
        const key = `${metric.post_id}-${metric.platform}`;
        if (!latestMetrics.has(key) || new Date(metric.created_at) > new Date(latestMetrics.get(key).created_at)) {
          latestMetrics.set(key, metric);
        }
      });

      // Filtrar posts que necesitan actualización
      const today = new Date();
      const postsNeedingUpdate: PostWithLatestMetrics[] = [];

      latestMetrics.forEach((metric: any) => {
        const metricDate = new Date(metric.created_at);
        const daysDiff = Math.floor((today.getTime() - metricDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysDiff >= daysThreshold) {
          // Buscar el influencer_post correspondiente
          const influencerPost = influencerPosts?.find((ip: any) => ip.id === metric.post_id);
          if (influencerPost) {
            postsNeedingUpdate.push({
              post_id: metric.post_id,
              platform: metric.platform,
              post_url: influencerPost.post_url || '',
              latest_metrics_created_at: metric.created_at,
              days_since_last_update: daysDiff,
              influencer_post_id: influencerPost.id,
              influencer_id: influencerPost.influencer_id,
              campaign_id: influencerPost.campaign_id,
              db_name: dbName // Agregar identificador de base de datos
            });
          }
        }
      });

      logger.info(`Encontrados ${postsNeedingUpdate.length} posts que necesitan actualización en ${dbName}`);
      return postsNeedingUpdate;

    } catch (error) {
      logger.error(`Error procesando ${dbName}:`, error);
      return [];
    }
  }

  /**
   * Obtiene posts que nunca han tenido métricas exitosas
   */
  static async getPostsWithoutMetrics(): Promise<PostWithLatestMetrics[]> {
    try {
      logger.info('Buscando posts sin métricas exitosas');

      const allPosts: PostWithLatestMetrics[] = [];

      // Procesar primera base de datos
      const postsFromDB1 = await this.getPostsWithoutMetricsFromDB(supabase, 'DB1');
      allPosts.push(...postsFromDB1);

      // Procesar segunda base de datos si está disponible
      if (supabase2) {
        logger.info('Procesando segunda base de datos para posts sin métricas...');
        const postsFromDB2 = await this.getPostsWithoutMetricsFromDB(supabase2, 'DB2');
        allPosts.push(...postsFromDB2);
      }

      logger.info(`Total de posts sin métricas: ${allPosts.length}`);
      return allPosts;

    } catch (error) {
      logger.error('Error en getPostsWithoutMetrics:', error);
      throw error;
    }
  }

  /**
   * Obtiene posts sin métricas de una base de datos específica
   */
  private static async getPostsWithoutMetricsFromDB(
    dbClient: any, 
    dbName: string
  ): Promise<PostWithLatestMetrics[]> {
    try {
      logger.info(`Buscando posts sin métricas exitosas en ${dbName}`);

      // Obtener todos los influencer_posts
      const { data: influencerPosts, error: ipError } = await dbClient
        .from('influencer_posts')
        .select(`
          id,
          post_url,
          platform,
          influencer_id,
          campaign_id
        `)
        .is('deleted_at', null);

      if (ipError) {
        logger.error(`Error consultando influencer_posts en ${dbName}:`, ipError);
        return [];
      }

      // Obtener todos los post_ids que tienen métricas exitosas
      const { data: successfulMetrics, error: metricsError } = await dbClient
        .from('post_metrics')
        .select('post_id')
        .eq('api_success', true);

      if (metricsError) {
        logger.error(`Error consultando métricas exitosas en ${dbName}:`, metricsError);
        return [];
      }

      // Crear set de post_ids con métricas exitosas
      const successfulPostIds = new Set(successfulMetrics?.map((m: any) => m.post_id) || []);

      // Filtrar posts sin métricas exitosas
      const postsWithoutMetrics = influencerPosts
        ?.filter((post: any) => !successfulPostIds.has(post.id))
        .map((post: any) => ({
          post_id: post.id,
          platform: post.platform,
          post_url: post.post_url || '',
          latest_metrics_created_at: '1970-01-01',
          days_since_last_update: 999, // Muchos días para que se procese
          influencer_post_id: post.id,
          influencer_id: post.influencer_id,
          campaign_id: post.campaign_id,
          db_name: dbName // Agregar identificador de base de datos
        })) || [];

      logger.info(`Encontrados ${postsWithoutMetrics.length} posts sin métricas en ${dbName}`);
      return postsWithoutMetrics;

    } catch (error) {
      logger.error(`Error procesando ${dbName}:`, error);
      return [];
    }
  }

  /**
   * Inserta métricas de post en la base de datos
   */
  static async insertPostMetrics(metrics: any): Promise<void> {
    try {
      // Corregir engagement_rate (dividir por 100 para que sea entre 0-1)
      if (metrics.engagement_rate && metrics.engagement_rate > 1) {
        metrics.engagement_rate = metrics.engagement_rate / 100;
      }

      const { error } = await supabase
        .from('post_metrics')
        .insert([metrics]);

      if (error) {
        logger.error('Error insertando métricas:', error);
        throw error;
      }

      logger.info(`Métricas insertadas exitosamente para post ${metrics.post_id}`);
    } catch (error) {
      logger.error('Error en insertPostMetrics:', error);
      throw error;
    }
  }

  /**
   * Actualiza métricas del influencer post
   */
  static async updateInfluencerPostMetrics(postId: string, metrics: any): Promise<void> {
    try {
      const updateData = {
        likes_count: metrics.likes_count || 0,
        comments_count: metrics.comments_count || 0,
        views_count: metrics.views_count || 0,
        engagement_rate: metrics.engagement_rate || 0,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('influencer_posts')
        .update(updateData)
        .eq('id', postId);

      if (error) {
        logger.error('Error actualizando métricas del influencer post:', error);
        throw error;
      }

      logger.info(`Métricas del influencer post actualizadas para ${postId}`);
    } catch (error) {
      logger.error('Error en updateInfluencerPostMetrics:', error);
      throw error;
    }
  }

  /**
   * Inserta temas en post_topics
   */
  static async insertPostTopics(postId: string, topics: any[]): Promise<void> {
    try {
      if (!topics || topics.length === 0) {
        logger.info(`No hay temas para insertar para el post ${postId}`);
        return;
      }

      const topicRecords = topics.map(topic => ({
        post_id: postId,
        topic_label: topic.topic_label,
        topic_description: topic.topic_description,
        keywords: topic.keywords || [],
        relevance_score: topic.relevance_score || 0.5,
        confidence_score: topic.confidence_score || 0.5,
        comment_count: topic.comment_count || 0,
        sentiment_distribution: topic.sentiment_distribution || { positive: 0.33, neutral: 0.34, negative: 0.33 },
        extracted_method: topic.extracted_method || 'openai-gpt',
        language_detected: topic.language_detected || 'es'
      }));

      logger.info(`Insertando ${topics.length} temas en post_topics para post ${postId}`);
      logger.info(`Temas a insertar:`, JSON.stringify(topicRecords, null, 2));

      const { error } = await supabase
        .from('post_topics')
        .insert(topicRecords);

      if (error) {
        logger.error('Error insertando temas:', error);
        throw error;
      }

      logger.info(`✅ ${topics.length} temas insertados exitosamente en post_topics para post ${postId}`);
    } catch (error) {
      logger.error('Error en insertPostTopics:', error);
      throw error;
    }
  }

  /**
   * Elimina temas existentes de un post antes de insertar nuevos
   */
  static async deleteExistingTopics(postId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('post_topics')
        .delete()
        .eq('post_id', postId);

      if (error) {
        logger.error('Error eliminando temas existentes:', error);
        throw error;
      }

      logger.info(`Temas existentes eliminados para post ${postId}`);
    } catch (error) {
      logger.error('Error en deleteExistingTopics:', error);
      throw error;
    }
  }
} 