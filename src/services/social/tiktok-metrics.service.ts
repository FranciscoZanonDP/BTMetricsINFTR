import axios from 'axios';
import logger from '../../config/logger';

// TikTok API configuration
const APIFY_API_TOKEN = process.env['APIFY_API_TOKEN'] || 'YOUR_APIFY_API_TOKEN';
const APIFY_METRICS_ACTOR_ID = 'clockworks~tiktok-scraper'; // GdWCkxBtKWOsKjdch
const APIFY_COMMENTS_ACTOR_ID = 'clockworks~tiktok-comments-scraper'; // BDec00yAmCm1QbMEI
const APIFY_API_BASE_URL = 'https://api.apify.com/v2';

export interface TikTokVideoMetrics {
  data: {
    basicTikTokVideo: {
      isAd: boolean;
      cover: string;
      plays: number;
      hearts: number;
      length: number;
      shares: number;
      audioId: string;
      videoId: string;
      comments: number;
      hashtags: string[];
      audioAlbum: string;
      audioTitle: string;
      engageRate: number;
      uploadDate: number;
      audioAuthor: string;
      isDuetEnabled: boolean;
      commerceHashtags: string[];
    };
  };
  error: string;
  success: boolean;
  quotaUsed: number;
  timestamp: number;
  quotaUsedTotal: number;
  remainingPlanCredit: number;
  remainingPrepurchasedCredit: number;
}

export interface TikTokComment {
  id: string;
  text: string;
  author: string;
  platform: string;
  likeCount: number;
  scrapedAt: string;
  replyCount: number;
  publishedAt: string;
}

export interface TikTokCommentsResponse {
  comments: TikTokComment[];
  analysis_metadata: {
    platform: string;
    model_used: string;
    analyzed_at: string;
    total_comments: number;
    processing_time_ms: number;
  };
}

export class TikTokMetricsService {
  private static instance: TikTokMetricsService;

  static getInstance(): TikTokMetricsService {
    if (!TikTokMetricsService.instance) {
      TikTokMetricsService.instance = new TikTokMetricsService();
    }
    return TikTokMetricsService.instance;
  }

  /**
   * Get video metrics using Apify TikTok Scraper
   */
  async getVideoMetrics(videoUrl: string): Promise<{
    success: boolean;
    data?: TikTokVideoMetrics;
    error?: string;
  }> {
    try {
      // Validate API token
      if (!APIFY_API_TOKEN || APIFY_API_TOKEN === 'YOUR_APIFY_API_TOKEN') {
        throw new Error('APIFY_API_TOKEN no configurado. Por favor configura tu token de Apify en el archivo .env');
      }

      // Clean URL if necessary
      const cleanUrl = this.cleanTikTokUrl(videoUrl);
      logger.info(`🔗 URL original: ${videoUrl}`);
      logger.info(`🧹 URL limpia: ${cleanUrl}`);

      logger.info(`🚀 Iniciando scraping de métricas con Apify actor: ${APIFY_METRICS_ACTOR_ID}`);

      // Start Apify run
      const runResponse = await axios.post(
        `${APIFY_API_BASE_URL}/acts/${APIFY_METRICS_ACTOR_ID}/runs?token=${APIFY_API_TOKEN}`,
        {
          postURLs: [cleanUrl]
        },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );

      if (!runResponse.data || !runResponse.data.data || !runResponse.data.data.id) {
        logger.error('❌ No se pudo iniciar el run de Apify para métricas');
        logger.error('📄 Respuesta:', runResponse.data);
        throw new Error('No se pudo iniciar el run de Apify para métricas');
      }

      const runId = runResponse.data.data.id;
      logger.info(`✅ Apify run iniciado con ID: ${runId}`);
      logger.info(`⏳ Esperando que el scraping se complete...`);

      // Wait for run to complete
      let runStatus = 'RUNNING';
      let attempts = 0;
      const maxAttempts = 12; // 2 minutes maximum

      while (runStatus === 'RUNNING' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 10000)); // 10 seconds

        const statusResponse = await axios.get(
          `${APIFY_API_BASE_URL}/acts/${APIFY_METRICS_ACTOR_ID}/runs/${runId}?token=${APIFY_API_TOKEN}`,
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
      logger.info(`📥 Obteniendo métricas del scraping...`);

      // Get run details to obtain dataset ID
      const runDetailsResponse = await axios.get(
        `${APIFY_API_BASE_URL}/acts/${APIFY_METRICS_ACTOR_ID}/runs/${runId}?token=${APIFY_API_TOKEN}`,
        { timeout: 10000 }
      );

      if (!runDetailsResponse.data) {
        logger.error('❌ No se pudo obtener la respuesta del run');
        throw new Error('No se pudo obtener la respuesta del run');
      }

      if (!runDetailsResponse.data.data || !runDetailsResponse.data.data.defaultDatasetId) {
        logger.error('❌ No se pudo obtener el ID del dataset del run');
        logger.error('📄 Respuesta del run:', runDetailsResponse.data);
        throw new Error('No se pudo obtener el ID del dataset del run');
      }

      const datasetId = runDetailsResponse.data.data.defaultDatasetId;
      logger.info(`📊 Dataset ID obtenido: ${datasetId}`);

      // Get results from dataset using correct endpoint
      const resultsResponse = await axios.get(
        `${APIFY_API_BASE_URL}/datasets/${datasetId}/items?token=${APIFY_API_TOKEN}&limit=1`,
        { timeout: 10000 }
      );

      if (!resultsResponse.data || !resultsResponse.data.length) {
        logger.error('❌ No se encontraron métricas del scraping');
        logger.error('📄 Respuesta completa:', resultsResponse.data);
        throw new Error('No se encontraron métricas del scraping');
      }

      const results = resultsResponse.data;
      logger.info(`📊 Métricas obtenidas del dataset: ${results.length} items`);

      const result = results[0];
      logger.info(`✅ Métricas obtenidas exitosamente para video TikTok`);
      
      // Check if we have the expected structure
      if (!result) {
        logger.error('❌ No se recibieron datos de Apify');
        throw new Error('No se recibieron datos de Apify');
      }

      // Map Apify response to expected format
      const mappedResult = {
        videoId: result.id || result.videoId,
        plays: result.playCount || result.plays || 0,
        hearts: result.diggCount || result.hearts || 0,
        comments: result.commentCount || result.comments || 0,
        shares: result.shareCount || result.shares || 0,
        cover: result.videoMeta?.coverUrl || result.cover || '',
        length: result.videoMeta?.duration || result.length || 0,
        audioId: result.musicMeta?.musicId || result.audioId || '',
        hashtags: result.hashtags?.map((h: any) => h.name).filter(Boolean) || result.hashtags || [],
        audioAlbum: result.musicMeta?.musicAlbum || result.audioAlbum || '',
        audioTitle: result.musicMeta?.musicName || result.audioTitle || '',
        engageRate: this.calculateEngagementRate(
          result.playCount || result.plays || 0,
          result.diggCount || result.hearts || 0,
          result.commentCount || result.comments || 0,
          result.shareCount || result.shares || 0
        ),
        uploadDate: result.createTime || result.uploadDate || Date.now(),
        audioAuthor: result.musicMeta?.musicAuthor || result.audioAuthor || '',
        isDuetEnabled: result.isDuetEnabled || false,
        commerceHashtags: result.commerceHashtags || [],
        isAd: result.isAd || result.isSponsored || false
      };

      logger.info(`📊 Datos del video mapeados:`, {
        videoId: mappedResult.videoId,
        plays: mappedResult.plays,
        hearts: mappedResult.hearts,
        comments: mappedResult.comments,
        shares: mappedResult.shares,
        engageRate: mappedResult.engageRate
      });

      logger.info(`🔧 Procesando datos para formato del sistema...`);

      return {
        success: true,
        data: {
          data: {
            basicTikTokVideo: mappedResult
          },
          error: '',
          success: true,
          quotaUsed: 1,
          timestamp: Date.now(),
          quotaUsedTotal: 1,
          remainingPlanCredit: 9999,
          remainingPrepurchasedCredit: 0
        }
      };

    } catch (error: any) {
      logger.error('❌ TikTok Metrics API failed:', error.response?.data || error.message);
      
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
   * Get video comments using Apify TikTok Comments Scraper
   */
  async getVideoComments(videoUrl: string, limit: number = 50): Promise<{
    success: boolean;
    comments?: TikTokComment[];
    error?: string;
    totalComments?: number;
  }> {
    try {
      // Validate API token
      if (!APIFY_API_TOKEN || APIFY_API_TOKEN === 'YOUR_APIFY_API_TOKEN') {
        throw new Error('APIFY_API_TOKEN no configurado. Por favor configura tu token de Apify en el archivo .env');
      }

      // Clean URL if necessary
      const cleanUrl = this.cleanTikTokUrl(videoUrl);
      logger.info(`🔗 URL original: ${videoUrl}`);
      logger.info(`🧹 URL limpia: ${cleanUrl}`);

      logger.info(`🚀 Iniciando scraping de comentarios con Apify actor: ${APIFY_COMMENTS_ACTOR_ID}`);

      // Start Apify run
      const runResponse = await axios.post(
        `${APIFY_API_BASE_URL}/acts/${APIFY_COMMENTS_ACTOR_ID}/runs?token=${APIFY_API_TOKEN}`,
        {
          postURLs: [cleanUrl],
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

      // Wait for run to complete
      let runStatus = 'RUNNING';
      let attempts = 0;
      const maxAttempts = 12; // 2 minutes maximum

      while (runStatus === 'RUNNING' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 10000)); // 10 seconds

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

      // Get run details to obtain dataset ID
      const runDetailsResponse = await axios.get(
        `${APIFY_API_BASE_URL}/acts/${APIFY_COMMENTS_ACTOR_ID}/runs/${runId}?token=${APIFY_API_TOKEN}`,
        { timeout: 10000 }
      );

      if (!runDetailsResponse.data) {
        logger.error('❌ No se pudo obtener la respuesta del run');
        throw new Error('No se pudo obtener la respuesta del run');
      }

      if (!runDetailsResponse.data.data || !runDetailsResponse.data.data.defaultDatasetId) {
        logger.error('❌ No se pudo obtener el ID del dataset del run');
        logger.error('📄 Respuesta del run:', runDetailsResponse.data);
        throw new Error('No se pudo obtener el ID del dataset del run');
      }

      const datasetId = runDetailsResponse.data.data.defaultDatasetId;
      logger.info(`📊 Dataset ID obtenido: ${datasetId}`);

      // Get comments from dataset using correct endpoint
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

      // Map Apify comments response to expected format
      const mappedComments = comments.map(comment => ({
        id: comment.cid || comment.id,
        text: comment.text || '',
        author: comment.uniqueId || comment.author || '',
        platform: 'tiktok',
        likeCount: comment.diggCount || comment.likeCount || 0,
        scrapedAt: new Date().toISOString(),
        replyCount: comment.replyCommentTotal || comment.replyCount || 0,
        publishedAt: comment.createTimeISO || comment.publishedAt || new Date().toISOString()
      }));

      // Validate comment structure
      const validComments = mappedComments.filter(comment => 
        comment && 
        comment.id && 
        comment.text && 
        comment.author
      );

      if (validComments.length === 0) {
        logger.warn('⚠️ No se encontraron comentarios válidos en la respuesta');
        return {
          success: true,
          comments: [],
          totalComments: 0
        };
      }

      logger.info(`✅ Comentarios obtenidos exitosamente para video TikTok`);
      logger.info(`📊 Datos de comentarios:`, {
        totalComments: validComments.length,
        firstComment: validComments[0]?.text?.substring(0, 50) + '...',
        sampleAuthor: validComments[0]?.author
      });

      return {
        success: true,
        comments: validComments,
        totalComments: validComments.length
      };

    } catch (error: any) {
      logger.error('❌ TikTok Comments API failed:', error.response?.data || error.message);
      
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
   * Clean TikTok URL for scraping
   */
  private cleanTikTokUrl(url: string): string {
    // Remove query parameters that might cause issues
    return url.split('?')[0] || url;
  }

  /**
   * Calculate engagement rate based on likes, comments, and shares
   */
  private calculateEngagementRate(plays: number, hearts: number, comments: number, shares: number): number {
    if (plays === 0) return 0;
    
    const totalEngagement = hearts + comments + shares;
    const engagementRate = (totalEngagement / plays);
    
    return Math.round(engagementRate * 10000) / 10000; // Round to 4 decimal places for precision
  }

  /**
   * Convert TikTok metrics to system format for database storage
   */
  convertToSystemFormat(
    postId: string,
    _videoUrl: string,
    tiktokMetrics: TikTokVideoMetrics
  ): any {
    logger.info(`🔄 Convirtiendo métricas de TikTok a formato del sistema para post: ${postId}`);
    
    const videoData = tiktokMetrics.data.basicTikTokVideo;
    
    logger.info(`📊 Datos raw recibidos:`, {
      plays: videoData.plays,
      hearts: videoData.hearts,
      comments: videoData.comments,
      shares: videoData.shares,
      engageRate: videoData.engageRate
    });

    // Calculate engagement rate (keep as decimal format)
    const engageRateForPlatform = videoData.engageRate / 100;

    logger.info(`📈 Métricas calculadas:`, {
      plays: videoData.plays,
      hearts: videoData.hearts,
      comments: videoData.comments,
      shares: videoData.shares,
      engageRate: `${(videoData.engageRate).toFixed(2)}%`,
      engageRateForPlatform: engageRateForPlatform.toFixed(6)
    });

    // Create system format response matching the database schema
    const systemFormat = {
      post_id: postId,
      platform: 'tiktok',
      content_id: postId,
      post_url: '', // Will be filled by the calling function
      title: null, // TikTok doesn't have titles like YouTube
      likes_count: videoData.hearts,
      comments_count: videoData.comments,
      views_count: videoData.plays,
      engagement_rate: videoData.engageRate, // Keep as decimal (already calculated correctly)
      platform_data: {
        video_id: videoData.videoId,
        audio_id: videoData.audioId,
        audio_title: videoData.audioTitle,
        audio_author: videoData.audioAuthor,
        video_duration: videoData.length,
        video_cover: videoData.cover,
        hashtags: videoData.hashtags,
        is_ad: videoData.isAd,
        is_duet_enabled: videoData.isDuetEnabled,
        commerce_hashtags: videoData.commerceHashtags,
        upload_date: videoData.uploadDate,
        shares_count: videoData.shares,
        engage_rate: engageRateForPlatform // Decimal format
      },
      quota_used: tiktokMetrics.quotaUsed,
      api_timestamp: tiktokMetrics.timestamp,
      api_success: tiktokMetrics.success,
      api_error: tiktokMetrics.error,
      raw_response: tiktokMetrics,
      comments_analysis: null
    };

    logger.info(`✅ Conversión completada exitosamente`);
    logger.info(`💾 Formato final:`, {
      post_id: systemFormat.post_id,
      platform: systemFormat.platform,
      likes_count: systemFormat.likes_count,
      comments_count: systemFormat.comments_count,
      views_count: systemFormat.views_count,
      engagement_rate: systemFormat.engagement_rate
    });

    return systemFormat;
  }
} 