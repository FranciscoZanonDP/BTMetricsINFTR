import { supabase } from '../config/database';
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

      // Consulta usando Supabase directamente sin función RPC
      const { data, error } = await supabase
        .from('post_metrics')
        .select(`
          post_id,
          platform,
          created_at
        `)
        .eq('api_success', true)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Error consultando post_metrics:', error);
        throw error;
      }

      // Obtener influencer_posts para hacer el join
      const { data: influencerPosts, error: ipError } = await supabase
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
        logger.error('Error consultando influencer_posts:', ipError);
        throw ipError;
      }

      // Crear mapa de posts más recientes por post_id
      const latestMetrics = new Map<string, any>();
      data?.forEach(metric => {
        const key = `${metric.post_id}-${metric.platform}`;
        if (!latestMetrics.has(key) || new Date(metric.created_at) > new Date(latestMetrics.get(key).created_at)) {
          latestMetrics.set(key, metric);
        }
      });

      // Filtrar posts que necesitan actualización
      const today = new Date();
      const postsNeedingUpdate: PostWithLatestMetrics[] = [];

      latestMetrics.forEach((metric) => {
        const metricDate = new Date(metric.created_at);
        
        // Comparar solo fecha (día y mes) sin considerar hora
        const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const metricDateOnly = new Date(metricDate.getFullYear(), metricDate.getMonth(), metricDate.getDate());
        
        // Calcular diferencia en días
        const timeDiff = todayDateOnly.getTime() - metricDateOnly.getTime();
        const daysSinceUpdate = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
        
        logger.debug(`📅 Comparando fechas: ${metricDateOnly.toISOString().split('T')[0]} vs ${todayDateOnly.toISOString().split('T')[0]} = ${daysSinceUpdate} días`);
        
        if (daysSinceUpdate >= daysThreshold) {
          // Buscar el influencer_post correspondiente
          const influencerPost = influencerPosts?.find(ip => ip.id === metric.post_id);
          
          if (influencerPost) {
            postsNeedingUpdate.push({
              post_id: metric.post_id,
              platform: metric.platform,
              post_url: influencerPost.post_url || '',
              latest_metrics_created_at: metric.created_at,
              days_since_last_update: daysSinceUpdate,
              influencer_post_id: influencerPost.id,
              influencer_id: influencerPost.influencer_id,
              campaign_id: influencerPost.campaign_id
            });
          }
        }
      });

      logger.info(`Encontrados ${postsNeedingUpdate.length} posts que necesitan actualización`);
      return postsNeedingUpdate;

    } catch (error) {
      logger.error('Error en getPostsNeedingUpdate:', error);
      throw error;
    }
  }

  /**
   * Obtiene posts que nunca han tenido métricas exitosas
   */
  static async getPostsWithoutMetrics(): Promise<PostWithLatestMetrics[]> {
    try {
      logger.info('Buscando posts sin métricas exitosas');

      // Obtener todos los influencer_posts
      const { data: influencerPosts, error: ipError } = await supabase
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
        logger.error('Error consultando influencer_posts:', ipError);
        throw ipError;
      }

      // Obtener todos los post_ids que tienen métricas exitosas
      const { data: successfulMetrics, error: metricsError } = await supabase
        .from('post_metrics')
        .select('post_id')
        .eq('api_success', true);

      if (metricsError) {
        logger.error('Error consultando métricas exitosas:', metricsError);
        throw metricsError;
      }

      // Crear set de post_ids con métricas exitosas
      const successfulPostIds = new Set(successfulMetrics?.map(m => m.post_id) || []);

      // Filtrar posts sin métricas exitosas
      const postsWithoutMetrics = influencerPosts
        ?.filter(post => !successfulPostIds.has(post.id))
        .map(post => ({
          post_id: post.id,
          platform: post.platform,
          post_url: post.post_url || '',
          latest_metrics_created_at: '1970-01-01',
          days_since_last_update: 999, // Muchos días para que se procese
          influencer_post_id: post.id,
          influencer_id: post.influencer_id,
          campaign_id: post.campaign_id
        })) || [];

      logger.info(`Encontrados ${postsWithoutMetrics.length} posts sin métricas`);
      return postsWithoutMetrics;

    } catch (error) {
      logger.error('Error en getPostsWithoutMetrics:', error);
      throw error;
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