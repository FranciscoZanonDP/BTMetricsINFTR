import axios from 'axios';
import logger from '../../config/logger';

// Apify API configuration for Instagram comments
const APIFY_API_TOKEN = process.env['APIFY_API_TOKEN'] || 'YOUR_APIFY_API_TOKEN';
const APIFY_COMMENTS_ACTOR_ID = 'apify~instagram-comment-scraper'; // SbK00X0JYCPblD2wp
const APIFY_API_BASE_URL = 'https://api.apify.com/v2';

export interface InstagramComment {
  postUrl: string;
  commentUrl: string;
  id: string;
  text: string;
  ownerUsername: string;
  ownerProfilePicUrl: string;
  timestamp: string;
  repliesCount: number;
  replies: any[];
  likesCount: number;
  owner: {
    fbid_v2: string;
    full_name: string;
    id: string;
    is_mentionable: boolean;
    is_private: boolean;
    is_verified: boolean;
    latest_reel_media: number;
    profile_pic_id: string;
    profile_pic_url: string;
    username: string;
  };
}

export interface InstagramCommentsResponse {
  success: boolean;
  data?: InstagramComment[];
  error?: string;
  totalComments?: number;
}

export class InstagramCommentsService {
  private static instance: InstagramCommentsService;

  static getInstance(): InstagramCommentsService {
    if (!InstagramCommentsService.instance) {
      InstagramCommentsService.instance = new InstagramCommentsService();
    }
    return InstagramCommentsService.instance;
  }

  /**
   * Obtiene comentarios de un post de Instagram usando Apify
   */
  async getPostComments(postUrl: string, limit: number = 50): Promise<InstagramCommentsResponse> {
    try {
      // Validar configuración
      if (!APIFY_API_TOKEN || APIFY_API_TOKEN === 'YOUR_APIFY_API_TOKEN') {
        throw new Error('APIFY_API_TOKEN no configurado. Por favor configura tu token de Apify en el archivo .env');
      }

      // Limpiar URL si es necesario
      const cleanUrl = this.cleanInstagramUrl(postUrl);
      logger.info(`🔗 URL original: ${postUrl}`);
      logger.info(`🧹 URL limpia: ${cleanUrl}`);

      logger.info(`🚀 Iniciando scraping de comentarios con Apify actor: ${APIFY_COMMENTS_ACTOR_ID}`);

      // Iniciar el run del actor
      const runResponse = await axios.post(
        `${APIFY_API_BASE_URL}/acts/${APIFY_COMMENTS_ACTOR_ID}/runs?token=${APIFY_API_TOKEN}`,
        {
          directUrls: [cleanUrl],
          resultsLimit: limit
        },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );

      if (!runResponse.data || !runResponse.data.data || !runResponse.data.data.id) {
        logger.error('❌ No se pudo iniciar el run de Apify para comentarios');
        logger.error('📄 Respuesta:', runResponse.data);
        throw new Error('No se pudo iniciar el run de Apify para comentarios');
      }

      const runId = runResponse.data.data.id;
      logger.info(`✅ Apify run iniciado con ID: ${runId}`);
      logger.info(`⏳ Esperando que el scraping se complete...`);

      // Esperar a que el run termine
      let runStatus = 'RUNNING';
      let attempts = 0;
      const maxAttempts = 12; // 2 minutos máximo

      while (runStatus === 'RUNNING' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 10000)); // 10 segundos

        const statusResponse = await axios.get(
          `${APIFY_API_BASE_URL}/acts/${APIFY_COMMENTS_ACTOR_ID}/runs/${runId}?token=${APIFY_API_TOKEN}`,
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
      logger.info(`📥 Obteniendo comentarios del scraping...`);

      // Obtener los detalles del run para conseguir el dataset ID
      const runDetailsResponse = await axios.get(
        `${APIFY_API_BASE_URL}/acts/${APIFY_COMMENTS_ACTOR_ID}/runs/${runId}?token=${APIFY_API_TOKEN}`,
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

      // Obtener comentarios del dataset usando el endpoint correcto
      const commentsResponse = await axios.get(
        `${APIFY_API_BASE_URL}/datasets/${datasetId}/items?token=${APIFY_API_TOKEN}&limit=${limit}`,
        { timeout: 10000 }
      );

      if (!commentsResponse.data || !Array.isArray(commentsResponse.data)) {
        logger.error('❌ No se encontraron comentarios del scraping');
        logger.error('📄 Respuesta completa:', commentsResponse.data);
        throw new Error('No se encontraron comentarios del scraping');
      }

      const comments = commentsResponse.data;
      logger.info(`📊 Comentarios obtenidos del dataset: ${comments.length} items`);

      // Validar estructura de comentarios
      const validComments = comments.filter(comment => 
        comment && 
        comment.id && 
        comment.text && 
        comment.ownerUsername
      );

      if (validComments.length === 0) {
        logger.warn('⚠️ No se encontraron comentarios válidos en la respuesta');
        return {
          success: true,
          data: [],
          totalComments: 0
        };
      }

      logger.info(`✅ Comentarios obtenidos exitosamente para post Instagram`);
      logger.info(`📊 Datos de comentarios:`, {
        totalComments: validComments.length,
        firstComment: validComments[0]?.text?.substring(0, 50) + '...',
        sampleOwner: validComments[0]?.ownerUsername
      });

      return {
        success: true,
        data: validComments,
        totalComments: validComments.length
      };

    } catch (error: any) {
      logger.error('❌ Instagram Comments API failed:', error.response?.data || error.message);
      
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
   * Limpia la URL de Instagram para el scraping
   */
  private cleanInstagramUrl(url: string): string {
    // Remover parámetros de query como ?img_index=1
    return url.split('?')[0] || url;
  }

  /**
   * Convierte comentarios de Instagram al formato del sistema
   */
  convertToSystemFormat(comments: InstagramComment[]): any[] {
    return comments.map(comment => ({
      id: comment.id,
      text: comment.text,
      author: comment.ownerUsername,
      author_full_name: comment.owner.full_name,
      author_profile_pic: comment.ownerProfilePicUrl,
      published_at: comment.timestamp,
      like_count: comment.likesCount,
      reply_count: comment.repliesCount,
      platform: 'instagram',
      comment_url: comment.commentUrl,
      post_url: comment.postUrl,
      is_verified: comment.owner.is_verified,
      is_private: comment.owner.is_private,
      raw_data: comment
    }));
  }
} 