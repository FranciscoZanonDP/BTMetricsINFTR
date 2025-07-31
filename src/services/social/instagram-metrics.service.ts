import axios from 'axios';
import logger from '../../config/logger';
import { InstagramCommentsService } from './instagram-comments.service';

// Apify API configuration for Instagram
const APIFY_API_TOKEN = process.env['APIFY_API_TOKEN'] || 'YOUR_APIFY_API_TOKEN';
const APIFY_ACTOR_ID = 'nH2AHrwxeTRJoN5hX'; // Instagram scraper actor alternativo
const APIFY_API_BASE_URL = 'https://api.apify.com/v2';

export interface InstagramPostMetrics {
  data: {
    basicInstagramPost: {
      id: string;
      url: string;
      likes: number;
      views: number;
      caption: string;
      isVideo: boolean;
      rawData: {
        id: string;
        alt: string | null;
        url: string;
        type: string;
        images: any[];
        caption: string;
        ownerId: string;
        hashtags: string[];
        inputUrl: string;
        mentions: string[];
        videoUrl?: string;
        musicInfo?: {
          audio_id: string;
          song_name: string;
          artist_name: string;
          should_mute_audio: boolean;
          uses_original_audio: boolean;
          should_mute_audio_reason: string;
        };
        shortCode: string;
        timestamp: string;
        childPosts: any[];
        displayUrl: string;
        likesCount: number;
        isSponsored: boolean;
        productType: string;
        taggedUsers: Array<{
          id: string;
          username: string;
          full_name: string;
          is_verified: boolean;
          profile_pic_url: string;
        }>;
        firstComment: string;
        commentsCount: number;
        ownerFullName: string;
        ownerUsername: string;
        videoDuration?: number;
        latestComments: Array<{
          id: string;
          text: string;
          owner: {
            id: string;
            username: string;
            is_verified: boolean;
            profile_pic_url: string;
          };
          replies: any[];
          timestamp: string;
          likesCount: number;
          repliesCount: number;
          ownerUsername: string;
          ownerProfilePicUrl: string;
        }>;
        videoPlayCount?: number;
        videoViewCount?: number;
        dimensionsWidth?: number;
        dimensionsHeight?: number;
        coauthorProducers?: any[];
      };
    };
  };
  error?: string;
  success: boolean;
}

export class InstagramMetricsService {
  private static instance: InstagramMetricsService;

  static getInstance(): InstagramMetricsService {
    if (!InstagramMetricsService.instance) {
      InstagramMetricsService.instance = new InstagramMetricsService();
    }
    return InstagramMetricsService.instance;
  }

  /**
   * Get post metrics using Apify Instagram Scraper
   */
  async getPostMetrics(postUrl: string): Promise<{
    success: boolean;
    data?: InstagramPostMetrics;
    error?: string;
  }> {
    try {
      // Validate API token
      if (!APIFY_API_TOKEN || APIFY_API_TOKEN === 'YOUR_APIFY_API_TOKEN') {
        throw new Error('APIFY_API_TOKEN no configurado. Por favor configura tu token de Apify en el archivo .env');
      }

      // Clean URL - remove query parameters that might cause issues
      const cleanUrl = postUrl.split('?')[0];
      logger.info(`🔗 URL original: ${postUrl}`);
      logger.info(`🧹 URL limpia: ${cleanUrl}`);
      logger.info(`🚀 Iniciando scraping con Apify actor: ${APIFY_ACTOR_ID}`);

      // Start Apify run
      const runResponse = await axios.post(
        `${APIFY_API_BASE_URL}/acts/${APIFY_ACTOR_ID}/runs?token=${APIFY_API_TOKEN}`,
        {
          username: [cleanUrl],
          resultsLimit: 1,
          maxRequestRetries: 3,
          maxConcurrency: 1
        },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 30000 // 30 segundos como YouTube
        }
      );

      if (!runResponse.data || !runResponse.data.data || !runResponse.data.data.id) {
        logger.error('❌ Respuesta de Apify inválida:', runResponse.data);
        throw new Error('No se pudo iniciar el scraping en Apify');
      }

      const runId = runResponse.data.data.id;
      logger.info(`✅ Apify run iniciado con ID: ${runId}`);
      logger.info(`⏳ Esperando que el scraping se complete...`);

      // Wait for run to complete (máximo 2 minutos)
      let runStatus = 'RUNNING';
      let attempts = 0;
      const maxAttempts = 12; // 2 minutos máximo

      while (runStatus === 'RUNNING' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
        
        const statusResponse = await axios.get(
          `${APIFY_API_BASE_URL}/acts/${APIFY_ACTOR_ID}/runs/${runId}?token=${APIFY_API_TOKEN}`,
          { timeout: 10000 }
        );

        runStatus = statusResponse.data.data.status;
        attempts++;

        logger.info(`📊 Apify run status: ${runStatus} (attempt ${attempts}/${maxAttempts})`);
      }

      if (runStatus !== 'SUCCEEDED') {
        logger.error(`❌ Apify run falló con status: ${runStatus}`);
        throw new Error(`Apify run failed with status: ${runStatus}`);
      }

      logger.info(`🎉 Apify run completado exitosamente!`);
      logger.info(`📥 Obteniendo resultados del scraping...`);

      // First, get the run details to obtain the dataset ID
      const runDetailsResponse = await axios.get(
        `${APIFY_API_BASE_URL}/acts/${APIFY_ACTOR_ID}/runs/${runId}?token=${APIFY_API_TOKEN}`,
        { timeout: 10000 }
      );

      if (!runDetailsResponse.data) {
        logger.error('❌ No se pudo obtener la respuesta del run');
        throw new Error('No se pudo obtener la respuesta del run');
      }

      // Log the complete response structure to debug
      logger.info('🔍 Estructura completa de la respuesta del run:', {
        hasData: !!runDetailsResponse.data,
        hasNestedData: !!runDetailsResponse.data.data,
        keys: Object.keys(runDetailsResponse.data),
        nestedKeys: runDetailsResponse.data.data ? Object.keys(runDetailsResponse.data.data) : [],
        defaultDatasetId: runDetailsResponse.data.data?.defaultDatasetId
      });

      if (!runDetailsResponse.data.data || !runDetailsResponse.data.data.defaultDatasetId) {
        logger.error('❌ No se pudo obtener el ID del dataset del run');
        logger.error('📄 Respuesta del run:', runDetailsResponse.data);
        throw new Error('No se pudo obtener el ID del dataset del run');
      }

      const datasetId = runDetailsResponse.data.data.defaultDatasetId;
      logger.info(`📊 Dataset ID obtenido: ${datasetId}`);

      // Get results from the dataset using the correct endpoint
      const resultsResponse = await axios.get(
        `${APIFY_API_BASE_URL}/datasets/${datasetId}/items?token=${APIFY_API_TOKEN}&limit=1`,
        { timeout: 10000 }
      );

      if (!resultsResponse.data || !resultsResponse.data.length) {
        logger.error('❌ No se encontraron resultados del scraping');
        logger.error('📄 Respuesta completa:', resultsResponse.data);
        throw new Error('No se encontraron resultados del scraping');
      }

      const results = resultsResponse.data;
      logger.info(`📊 Resultados obtenidos del dataset: ${results.length} items`);

      const result = results[0];
      logger.info(`✅ Métricas obtenidas exitosamente para post Instagram`);
      logger.info(`📊 Datos del post:`, {
        id: result.id,
        likesCount: result.likesCount,
        commentsCount: result.commentsCount,
        videoViewCount: result.videoViewCount,
        videoPlayCount: result.videoPlayCount,
        type: result.type,
        caption: result.caption?.substring(0, 50) + '...'
      });

      // Check if we have the expected structure
      if (!result) {
        logger.error('❌ No se recibieron datos de Apify');
        throw new Error('No se recibieron datos de Apify');
      }

      // Log the complete structure to understand what we received
      logger.info('🔍 Estructura completa recibida de Apify:', {
        hasId: !!result.id,
        hasLikesCount: !!result.likesCount,
        hasCommentsCount: !!result.commentsCount,
        hasCaption: !!result.caption,
        keys: Object.keys(result)
      });

      if (!result.likesCount) {
        logger.error('❌ Estructura de datos inesperada de Apify - falta likesCount');
        logger.error('🔍 Resultado recibido:', result);
        throw new Error('Estructura de datos inesperada de Apify - falta likesCount');
      }

      logger.info(`🔧 Procesando datos para formato del sistema...`);

      return {
        success: true,
        data: {
          data: {
            basicInstagramPost: {
              id: result.id,
              url: result.url,
              likes: result.likesCount,
              views: result.videoViewCount || result.videoPlayCount || 0,
              caption: result.caption || '',
              isVideo: result.type === 'Video',
              rawData: result
            }
          },
          success: true
        }
      };

    } catch (error: any) {
      logger.error('❌ Instagram API failed:', error.response?.data || error.message);
      
      // Log more details about the error
      if (error.response) {
        logger.error('📡 Error response:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        });
      }
      
      if (error.request) {
        logger.error('🌐 Error request:', error.request);
      }
      
      return { 
        success: false, 
        error: error.response?.data?.error?.message || error.message || 'Error desconocido'
      };
    }
  }

  /**
   * Obtiene comentarios de un post de Instagram
   */
  async getPostComments(postUrl: string, limit: number = 50): Promise<{
    success: boolean;
    data?: any[];
    error?: string;
    totalComments?: number;
  }> {
    try {
      const commentsService = InstagramCommentsService.getInstance();
      const result = await commentsService.getPostComments(postUrl, limit);
      
      if (result.success && result.data) {
        // Convertir al formato del sistema
        const systemFormatComments = commentsService.convertToSystemFormat(result.data);
        return {
          success: true,
          data: systemFormatComments,
          totalComments: result.totalComments || 0
        };
      }
      
      return result;
    } catch (error: any) {
      logger.error('❌ Error obteniendo comentarios de Instagram:', error);
      return {
        success: false,
        error: error.message || 'Error desconocido obteniendo comentarios'
      };
    }
  }

  /**
   * Convert Instagram metrics to system format for database storage
   */
  convertToSystemFormat(
    postId: string,
    _postUrl: string,
    instagramMetrics: InstagramPostMetrics
  ): any {
    logger.info(`🔄 Convirtiendo métricas de Instagram a formato del sistema para post: ${postId}`);
    
    const postData = instagramMetrics.data.basicInstagramPost;
    const rawData = postData.rawData;
    
    logger.info(`📊 Datos raw recibidos:`, {
      likesCount: rawData.likesCount,
      commentsCount: rawData.commentsCount,
      videoViewCount: rawData.videoViewCount,
      videoPlayCount: rawData.videoPlayCount,
      type: rawData.type
    });

    // Calculate engagement rate
    const likes = rawData.likesCount || 0;
    const comments = rawData.commentsCount || 0;
    const views = rawData.videoViewCount || rawData.videoPlayCount || likes; // Fallback to likes if no views
    
    let engagementRate = 0;
    if (views > 0) {
      engagementRate = ((likes + comments) / views) * 100;
    }

    // Calcular engageRate para platform_data (entre 0-1) - dividido por 100 para decimal pequeño
    const engageRateForPlatform = views > 0 ? ((likes + comments) / views) / 100 : 0;

    logger.info(`📈 Métricas calculadas:`, {
      likes,
      comments,
      views,
      engagementRate: `${engagementRate.toFixed(2)}%`,
      engageRateForPlatform: engageRateForPlatform.toFixed(6)
    });

    // Crear estructura de platform_data según el formato requerido (como YouTube)
    const platformData = {
      data: {
        basicInstagramPost: {
          lang: "spa",
          likes: likes,
          title: rawData.caption || "",
          views: views,
          length: rawData.videoDuration || 0,
          postId: rawData.id,
          category: "Social Media",
          comments: comments,
          hashtags: rawData.hashtags || [],
          isVideo: rawData.type === 'Video',
          engageRate: engageRateForPlatform,
          uploadDate: new Date(rawData.timestamp).getTime(),
          isStreaming: false,
          isPaidPromote: rawData.isSponsored || false,
          commentLikeRatio: likes > 0 ? comments / likes : 0,
          selfCommentRatio: 0,
          commentReplyRatio: 0,
          // Datos específicos de Instagram
          shortCode: rawData.shortCode,
          ownerId: rawData.ownerId,
          ownerUsername: rawData.ownerUsername,
          ownerFullName: rawData.ownerFullName,
          mentions: rawData.mentions || [],
          taggedUsers: rawData.taggedUsers || [],
          firstComment: rawData.firstComment || "",
          latestComments: rawData.latestComments || [],
          videoPlayCount: rawData.videoPlayCount,
          videoViewCount: rawData.videoViewCount,
          dimensionsWidth: rawData.dimensionsWidth,
          dimensionsHeight: rawData.dimensionsHeight,
          productType: rawData.productType,
          musicInfo: rawData.musicInfo,
          videoUrl: rawData.videoUrl,
          imageUrl: rawData.displayUrl
        }
      },
      error: "",
      success: true,
      quotaUsed: 1,
      timestamp: Date.now(),
      quotaUsedTotal: 1,
      remainingPlanCredit: 9999,
      remainingPrepurchasedCredit: 0
    };

    // Create system format response matching the database schema (como YouTube)
    const systemFormat = {
      post_id: postId,
      platform: 'instagram',
      content_id: postId, // Using post_id as content_id
      post_url: '', // Will be filled by the calling function
      title: rawData.caption || null,
      likes_count: likes,
      comments_count: comments,
      views_count: views,
      engagement_rate: engagementRate,
      platform_data: platformData,
      quota_used: 1,
      api_timestamp: Date.now(),
      api_success: true,
      api_error: null,
      raw_response: platformData,
      comments_analysis: null
    };

    logger.info(`✅ Conversión completada exitosamente`);
    logger.info(`💾 Formato final:`, {
      post_id: systemFormat.post_id,
      platform: systemFormat.platform,
      likes_count: systemFormat.likes_count,
      comments_count: systemFormat.comments_count,
      views_count: systemFormat.views_count,
      engagement_rate: `${systemFormat.engagement_rate.toFixed(2)}%`
    });

    return systemFormat;
  }
} 