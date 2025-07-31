import axios from 'axios';
import logger from '../../config/logger';

// YouTube API configuration
const YOUTUBE_API_KEY = process.env['YOUTUBE_API_KEY'] || 'YOUR_YOUTUBE_API_KEY';
const YOUTUBE_API_BASE_URL = 'https://www.googleapis.com/youtube/v3';

export interface YouTubeVideoMetrics {
  items: Array<{
    id: string;
    snippet: {
      title: string;
      description: string;
      publishedAt: string;
      thumbnails: {
        default: { url: string; width: number; height: number };
        medium: { url: string; width: number; height: number };
        high: { url: string; width: number; height: number };
      };
      channelTitle: string;
      channelId: string;
      tags: string[];
      categoryId: string;
      defaultLanguage: string;
      defaultAudioLanguage: string;
    };
    statistics: {
      viewCount: string;
      likeCount: string;
      commentCount: string;
      favoriteCount: string;
    };
    contentDetails: {
      duration: string;
      dimension: {
        width: string;
        height: string;
      };
      definition: string;
      caption: string;
      licensedContent: boolean;
      contentRating: any;
      projection: string;
    };
  }>;
  pageInfo: {
    totalResults: number;
    resultsPerPage: number;
  };
}

export interface YouTubeComment {
  id: string;
  snippet: {
    textDisplay: string;
    authorDisplayName: string;
    authorProfileImageUrl: string;
    authorChannelUrl: string;
    authorChannelId: {
      value: string;
    };
    likeCount: number;
    publishedAt: string;
    updatedAt: string;
    totalReplyCount: number;
  };
}

export interface YouTubeCommentsResponse {
  items: YouTubeComment[];
  nextPageToken?: string;
  pageInfo: {
    totalResults: number;
    resultsPerPage: number;
  };
}

export class YouTubeMetricsService {
  private static instance: YouTubeMetricsService;

  static getInstance(): YouTubeMetricsService {
    if (!YouTubeMetricsService.instance) {
      YouTubeMetricsService.instance = new YouTubeMetricsService();
    }
    return YouTubeMetricsService.instance;
  }

  /**
   * Extract video ID from YouTube URL
   */
  private extractVideoId(url: string): string | null {
    try {
      // Handle different YouTube URL formats
      const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/,
        /youtube\.com\/v\/([A-Za-z0-9_-]{11})/,
        /youtube\.com\/watch\?.*v=([A-Za-z0-9_-]{11})/,
        /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/
      ];

      for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
          logger.info(`Video ID extraído: ${match[1]}`);
          return match[1];
        }
      }

      logger.warn(`No se pudo extraer Video ID de la URL: ${url}`);
      return null;
    } catch (error) {
      logger.error('Error extrayendo Video ID:', error);
      return null;
    }
  }

  /**
   * Convert ISO 8601 duration to seconds
   */
  private parseDuration(duration: string): number {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;

    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    const seconds = parseInt(match[3] || '0');

    return hours * 3600 + minutes * 60 + seconds;
  }

  /**
   * Get video metrics using YouTube Data API
   */
  async getVideoMetrics(videoUrl: string): Promise<{
    success: boolean;
    data?: YouTubeVideoMetrics;
    error?: string;
  }> {
    try {
      // Validar API key
      if (!YOUTUBE_API_KEY || YOUTUBE_API_KEY === 'YOUR_YOUTUBE_API_KEY') {
        throw new Error('YouTube API key no configurada');
      }

      const videoId = this.extractVideoId(videoUrl);
      if (!videoId) {
        throw new Error('No se pudo extraer el ID del video de la URL');
      }

      logger.info(`Obteniendo métricas para video ID: ${videoId}`);

      const response = await axios.get(`${YOUTUBE_API_BASE_URL}/videos`, {
        params: {
          part: 'snippet,statistics,contentDetails',
          id: videoId,
          key: YOUTUBE_API_KEY
        },
        timeout: 30000
      });

      if (!response.data || !response.data.items || response.data.items.length === 0) {
        throw new Error('No se encontraron datos del video');
      }

      logger.info(`✅ Métricas obtenidas exitosamente para video ${videoId}`);
      return { success: true, data: response.data };

    } catch (error: any) {
      logger.error('YouTube API failed:', error.response?.data || error.message);
      return { 
        success: false, 
        error: error.response?.data?.error?.message || error.message || 'Error desconocido'
      };
    }
  }

  /**
   * Obtiene comentarios reales de un video de YouTube
   */
  async getVideoComments(videoUrl: string, maxComments: number = 100): Promise<{ success: boolean; comments?: any[]; error?: string; }> {
    try {
      // Validar API key
      if (!YOUTUBE_API_KEY || YOUTUBE_API_KEY === 'YOUR_YOUTUBE_API_KEY') {
        throw new Error('YouTube API key no configurada');
      }

      const videoId = this.extractVideoId(videoUrl);
      if (!videoId) {
        throw new Error('No se pudo extraer el ID del video de la URL');
      }

      logger.info(`Obteniendo comentarios para video ID: ${videoId} (máximo ${maxComments})`);

      const comments: any[] = [];
      let nextPageToken: string | undefined;

      do {
        const response = await axios.get('https://www.googleapis.com/youtube/v3/commentThreads', {
          params: {
            part: 'snippet',
            videoId: videoId,
            maxResults: Math.min(100, maxComments - comments.length),
            order: 'relevance',
            key: YOUTUBE_API_KEY,
            ...(nextPageToken && { pageToken: nextPageToken })
          },
          timeout: 30000
        });

        if (!response.data || !response.data.items) {
          break;
        }

        // Procesar comentarios
        const videoComments = response.data.items.map((item: any) => {
          const comment = item.snippet.topLevelComment.snippet;
          return {
            id: item.snippet.topLevelComment.id,
            text: comment.textDisplay,
            author: comment.authorDisplayName,
            authorChannelId: comment.authorChannelId?.value,
            publishedAt: comment.publishedAt,
            likeCount: comment.likeCount,
            replyCount: item.snippet.totalReplyCount,
            platform: 'youtube',
            scrapedAt: new Date().toISOString()
          };
        });

        comments.push(...videoComments);
        nextPageToken = response.data.nextPageToken;

        // Pausa entre requests para respetar rate limits
        if (nextPageToken && comments.length < maxComments) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } while (nextPageToken && comments.length < maxComments);

      logger.info(`✅ ${comments.length} comentarios obtenidos para video ${videoId}`);
      return { success: true, comments };

    } catch (error: any) {
      logger.error('Error obteniendo comentarios de YouTube:', error.response?.data || error.message);
      return { 
        success: false, 
        error: error.response?.data?.error?.message || error.message || 'Error desconocido'
      };
    }
  }

  /**
   * Convert YouTube metrics to system format for database storage
   */
  convertToSystemFormat(
    postId: string,
    _videoUrl: string,
    youtubeMetrics: YouTubeVideoMetrics
  ): any {
    const videoData = youtubeMetrics.items[0];
    if (!videoData) {
      throw new Error('No se encontraron datos del video');
    }
    const snippet = videoData.snippet;
    const statistics = videoData.statistics;
    const contentDetails = videoData.contentDetails;

    // Calculate engagement rate
    const views = parseInt(statistics.viewCount || '0');
    const likes = parseInt(statistics.likeCount || '0');
    const comments = parseInt(statistics.commentCount || '0');
    
    let engagementRate = 0;
    if (views > 0) {
      engagementRate = ((likes + comments) / views) * 100;
    }

    // Calcular engageRate para platform_data (entre 0-1)
    const engageRateForPlatform = views > 0 ? ((likes + comments) / views) : 0;

    // Calcular duración en segundos
    const durationInSeconds = this.parseDuration(contentDetails.duration);

    // Crear estructura de platform_data según el formato requerido
    const platformData = {
      data: {
        basicYoutubePost: {
          lang: "spa",
          likes: likes,
          title: snippet.title || "",
          views: views,
          length: durationInSeconds,
          videoId: videoData.id,
          category: snippet.categoryId || "Entertainment",
          comments: comments,
          hashtags: snippet.tags || [],
          isShorts: durationInSeconds <= 60,
          engageRate: engageRateForPlatform,
          uploadDate: new Date(snippet.publishedAt).getTime(),
          isStreaming: false,
          isPaidPromote: false,
          commentLikeRatio: likes > 0 ? comments / likes : 0,
          selfCommentRatio: 0,
          commentReplyRatio: 0
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

    // Create system format response matching the database schema
    const systemFormat = {
      post_id: postId,
      platform: 'youtube',
      content_id: postId, // Using post_id as content_id
      post_url: '', // Will be filled by the calling function
      title: snippet.title || null,
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

    return systemFormat;
  }
} 