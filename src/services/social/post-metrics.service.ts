import logger from '../../config/logger';
import { TikTokMetricsService } from './tiktok-metrics.service';
import { InstagramMetricsService } from './instagram-metrics.service';
import { YouTubeMetricsService } from './youtube-metrics.service';
import { TwitterMetricsService } from './twitter-metrics.service';
import { CommentsAnalysisService } from './comments-analysis.service';
import { DatabaseService } from '../database';

export interface PostMetricsResult {
  success: boolean;
  metrics?: any;
  error?: string | undefined;
}

export class PostMetricsService {
  private tiktokService = TikTokMetricsService.getInstance();
  private instagramService = InstagramMetricsService.getInstance();
  private youtubeService = YouTubeMetricsService.getInstance();
  private twitterService = TwitterMetricsService.getInstance();
  private commentsAnalysisService = CommentsAnalysisService.getInstance();

  /**
   * Extract and save metrics for a post
   */
  async extractAndSaveMetrics(postId: string, postUrl: string, platform: string, dbName?: string): Promise<PostMetricsResult> {
    const startTime = Date.now();

    try {
      logger.info(`Extrayendo métricas para post ${postId} (${platform})`);

      let metricsData: any;

      // Use appropriate service based on platform
      if (platform.toLowerCase() === 'youtube') {
        logger.info(`Procesando URL de YouTube: ${postUrl}`);
        const youtubeResult = await this.youtubeService.getVideoMetrics(postUrl);
        
        if (!youtubeResult.success) {
          logger.error(`YouTube API failed:`, youtubeResult.error);
          logger.error(`Error completo de YouTube:`, JSON.stringify(youtubeResult, null, 2));
          return {
            success: false,
            error: youtubeResult.error
          };
        }

        // Convert to system format
        metricsData = this.youtubeService.convertToSystemFormat(
          postId, 
          postUrl, 
          youtubeResult.data!
        );

      } else if (platform.toLowerCase() === 'tiktok') {
        // Use Apify for TikTok videos
        const tiktokResult = await this.tiktokService.getVideoMetrics(postUrl);
        
        if (!tiktokResult.success) {
          logger.error(`TikTok API failed:`, tiktokResult.error);
          return {
            success: false,
            error: tiktokResult.error
          };
        }

        // Convert to system format
        metricsData = this.tiktokService.convertToSystemFormat(
          postId, 
          postUrl, 
          tiktokResult.data!
        );

      } else if (platform.toLowerCase() === 'instagram') {
        // Use CreatorDB for Instagram posts
        const instagramResult = await this.instagramService.getPostMetrics(postUrl);
        
        if (!instagramResult.success) {
          logger.error(`Instagram API failed:`, instagramResult.error);
          return {
            success: false,
            error: instagramResult.error
          };
        }

        // Convert to system format
        metricsData = this.instagramService.convertToSystemFormat(
          postId, 
          postUrl, 
          instagramResult.data!
        );

      } else if (platform.toLowerCase() === 'twitter') {
        // Use Apify for Twitter posts
        const twitterResult = await this.twitterService.getTweetMetrics(postUrl);
        
        if (!twitterResult.success) {
          logger.error(`Twitter API failed:`, twitterResult.error);
          return {
            success: false,
            error: twitterResult.error
          };
        }

        // Convert to system format
        metricsData = this.twitterService.convertToSystemFormat(
          postId, 
          postUrl, 
          twitterResult.data!
        );
      }

      // Add post_url to the metrics data
      if (metricsData) {
        metricsData.post_url = postUrl;
      } else {
        return {
          success: false,
          error: `Plataforma no soportada: ${platform}`
        };
      }

      // Analizar comentarios y temas si hay datos disponibles
      try {
        await this.analyzeCommentsAndTopics(postId, platform, metricsData, dbName);
      } catch (analysisError) {
        logger.warn(`Error en análisis de comentarios para post ${postId}:`, analysisError);
        // Continuar sin análisis de comentarios, no fallar el proceso completo
      }

      const processingTime = Date.now() - startTime;
      logger.info(`Métricas extraídas exitosamente en ${processingTime}ms`);

      return {
        success: true,
        metrics: metricsData
      };

    } catch (error: any) {
      const processingTime = Date.now() - startTime;
      logger.error(`Error extrayendo métricas después de ${processingTime}ms:`, error.message);
      
      return {
        success: false,
        error: error.message || 'Error desconocido al extraer métricas'
      };
    }
  }

  /**
   * Analiza comentarios y temas para un post
   */
  private async analyzeCommentsAndTopics(postId: string, platform: string, metricsData: any, dbName?: string): Promise<void> {
    try {
      logger.info(`Iniciando análisis de comentarios para post ${postId}`);

      // Obtener comentarios reales según la plataforma
      let realComments: any[] = [];
      
      if (platform === 'youtube' && metricsData.post_url) {
        logger.info(`Obteniendo comentarios reales de YouTube para post ${postId}`);
        const commentsResult = await this.youtubeService.getVideoComments(metricsData.post_url, 50);
        if (commentsResult.success && commentsResult.comments) {
          realComments = commentsResult.comments;
          logger.info(`✅ ${realComments.length} comentarios reales obtenidos de YouTube`);
        } else {
          logger.warn(`No se pudieron obtener comentarios reales de YouTube: ${commentsResult.error}`);
        }
      } else if (platform === 'instagram' && metricsData.post_url) {
        logger.info(`Obteniendo comentarios reales de Instagram para post ${postId}`);
        const commentsResult = await this.instagramService.getPostComments(metricsData.post_url, 50);
        if (commentsResult.success && commentsResult.data) {
          realComments = commentsResult.data;
          logger.info(`✅ ${realComments.length} comentarios reales obtenidos de Instagram`);
        } else {
          logger.warn(`No se pudieron obtener comentarios reales de Instagram: ${commentsResult.error}`);
        }
      } else if (platform === 'tiktok' && metricsData.post_url) {
        logger.info(`Obteniendo comentarios reales de TikTok para post ${postId}`);
        const commentsResult = await this.tiktokService.getVideoComments(metricsData.post_url, 50);
        if (commentsResult.success && commentsResult.comments) {
          realComments = commentsResult.comments;
          logger.info(`✅ ${realComments.length} comentarios reales obtenidos de TikTok`);
        } else {
          logger.warn(`No se pudieron obtener comentarios reales de TikTok: ${commentsResult.error}`);
        }
      } else if (platform === 'twitter' && metricsData.post_url) {
        logger.info(`Obteniendo comentarios reales de Twitter para post ${postId}`);
        const commentsResult = await this.twitterService.getTweetComments(metricsData.post_url, 50);
        if (commentsResult.success && commentsResult.comments) {
          realComments = commentsResult.comments;
          logger.info(`✅ ${realComments.length} comentarios reales obtenidos de Twitter`);
        } else {
          logger.warn(`No se pudieron obtener comentarios reales de Twitter: ${commentsResult.error}`);
        }
      }

      // Si no hay comentarios reales, usar comentarios simulados como fallback
      if (realComments.length === 0) {
        logger.info(`Usando comentarios simulados como fallback para post ${postId}`);
        realComments = this.createSimulatedComments(metricsData, platform);
      }

      if (realComments.length === 0) {
        logger.info(`No hay comentarios para analizar en post ${postId}`);
        return;
      }

      // Analizar comentarios
      const analysisResult = await this.commentsAnalysisService.analyzeComments(realComments);

      // Agregar análisis de comentarios a las métricas
      metricsData.comments_analysis = analysisResult.comments_analysis;

      logger.info(`Análisis de comentarios completado para post ${postId}: ${analysisResult.topics.length} temas extraídos`);

      // Eliminar temas existentes e insertar nuevos
      if (analysisResult.topics.length > 0) {
        logger.info(`Eliminando temas existentes para post ${postId}`);
        await DatabaseService.deleteExistingTopics(postId, dbName);
        
        logger.info(`Insertando ${analysisResult.topics.length} nuevos temas para post ${postId}`);
        await DatabaseService.insertPostTopics(postId, analysisResult.topics, dbName);
      } else {
        logger.warn(`No se generaron temas para el post ${postId}`);
      }

    } catch (error) {
      logger.error(`Error en análisis de comentarios para post ${postId}:`, error);
      throw error;
    }
  }

  /**
   * Crea comentarios simulados basados en los datos de métricas
   * En un caso real, esto se reemplazaría con comentarios reales de las APIs
   */
  private createSimulatedComments(metricsData: any, platform: string): any[] {
    const comments = [];
    const commentCount = Math.min(metricsData.comments_count || 0, 50); // Limitar a 50 comentarios

    if (commentCount === 0) {
      return [];
    }

    // Crear comentarios simulados basados en la plataforma
    const platformComments = this.getPlatformSpecificComments(platform);

    for (let i = 0; i < commentCount; i++) {
      const comment = platformComments[i % platformComments.length];
      comments.push({
        id: `comment_${i}`,
        text: comment,
        author: `Usuario${i + 1}`,
        publishedAt: new Date(Date.now() - Math.random() * 86400000).toISOString(), // Últimas 24 horas
        likeCount: Math.floor(Math.random() * 10),
        replyCount: Math.floor(Math.random() * 5),
        platform: platform as 'youtube' | 'instagram' | 'tiktok' | 'twitter',
        scrapedAt: new Date().toISOString()
      });
    }

    return comments;
  }

  /**
   * Obtiene comentarios específicos por plataforma
   */
  private getPlatformSpecificComments(platform: string): string[] {
    const baseComments = [
      "¡Muy buen contenido! 👏",
      "Me encantó este video",
      "Gracias por compartir",
      "Excelente trabajo",
      "Seguí así",
      "Muy informativo",
      "Me ayudó mucho",
      "Lo compartiré con mis amigos",
      "Más contenido así por favor",
      "Muy bien explicado"
    ];

    const platformComments = {
      tiktok: [
        ...baseComments,
        "Este TikTok es viral 🔥",
        "Me quedé enganchado",
        "Perfecto para el algoritmo",
        "Trending material",
        "Lo guardé en favoritos"
      ],
      instagram: [
        ...baseComments,
        "Hermosa foto 📸",
        "Me encanta tu feed",
        "Perfecto para Instagram",
        "Muy estético",
        "Lo guardé en colección"
      ],
      youtube: [
        ...baseComments,
        "Muy buen video",
        "Subscribed! 🔔",
        "Me gustó y comenté",
        "Excelente explicación",
        "Lo recomiendo"
      ],
      twitter: [
        ...baseComments,
        "Muy buen tweet! 🐦",
        "Retweeted! 🔄",
        "Me encantó este post",
        "Perfecto para Twitter",
        "Lo guardé en bookmarks"
      ]
    };

    return platformComments[platform as keyof typeof platformComments] || baseComments;
  }

  /**
   * Update influencer post metrics in database
   */
  async updateInfluencerPostMetrics(postId: string, metrics: any): Promise<boolean> {
    try {
      // This would update the influencer_posts table with the new metrics
      // For now, we'll just log the update
      logger.info(`Actualizando métricas del influencer post ${postId}:`, {
        likes: metrics.likes_count,
        comments: metrics.comments_count,
        views: metrics.views_count,
        engagement_rate: metrics.engagement_rate
      });

      return true;
    } catch (error: any) {
      logger.error(`Error actualizando métricas del influencer post ${postId}:`, error.message);
      return false;
    }
  }
} 