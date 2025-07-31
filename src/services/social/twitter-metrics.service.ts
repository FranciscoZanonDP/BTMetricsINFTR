import axios from 'axios';
import logger from '../../config/logger';

// Twitter API configuration
const APIFY_API_TOKEN = process.env['APIFY_API_TOKEN'] || 'YOUR_APIFY_API_TOKEN';
const APIFY_METRICS_ACTOR_ID = 'pratikdani~twitter-posts-scraper';
const APIFY_COMMENTS_ACTOR_ID = 'aLoAjAhdEpacDuwjr';
const APIFY_API_BASE_URL = 'https://api.apify.com/v2';

export interface TwitterPostMetrics {
  data: {
    basicTwitterPost: {
      tweet_id: string;
      screen_name: string;
      text: string;
      created_at: string;
      favorites: number;
      retweets: number;
      replies: number;
      quotes: number;
      bookmarks: number;
      views: string;
      lang: string;
      source: string;
      conversation_id: string;
      is_retweet: boolean;
      is_quote: boolean;
      is_reply: boolean;
      user_info: {
        screen_name: string;
        name: string;
        created_at: string;
        description: string;
        rest_id: string;
        followers_count: number;
        favourites_count: number;
        avatar: string;
        verified: boolean;
        friends_count: number;
        location: string | null;
      };
      entities: {
        hashtags: any[];
        symbols: any[];
        timestamps: any[];
        urls: any[];
        user_mentions: any[];
      };
      media: any[];
      engageRate: number;
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

export interface TwitterComment {
  id: string;
  text: string;
  author: string;
  platform: string;
  likeCount: number;
  scrapedAt: string;
  replyCount: number;
  publishedAt: string;
  retweetCount?: number;
  quoteCount?: number;
  bookmarkCount?: number;
  viewCount?: string;
}

export interface TwitterCommentsResponse {
  comments: TwitterComment[];
  analysis_metadata: {
    platform: string;
    model_used: string;
    analyzed_at: string;
    total_comments: number;
    processing_time_ms: number;
  };
}

export class TwitterMetricsService {
  private static instance: TwitterMetricsService;

  static getInstance(): TwitterMetricsService {
    if (!TwitterMetricsService.instance) {
      TwitterMetricsService.instance = new TwitterMetricsService();
    }
    return TwitterMetricsService.instance;
  }

  /**
   * Get tweet metrics using Apify Twitter Posts Scraper
   */
  async getTweetMetrics(tweetUrl: string): Promise<{
    success: boolean;
    data?: TwitterPostMetrics;
    error?: string;
  }> {
    try {
      // Validate API token
      if (!APIFY_API_TOKEN || APIFY_API_TOKEN === 'YOUR_APIFY_API_TOKEN') {
        throw new Error('APIFY_API_TOKEN no configurado. Por favor configura tu token de Apify en el archivo .env');
      }

      // Clean URL if necessary
      const cleanUrl = this.cleanTwitterUrl(tweetUrl);
      logger.info(`🔗 URL original: ${tweetUrl}`);
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
            'Content-Type': 'application/json',
          },
        }
      );

      const runId = runResponse.data.data.id;
      logger.info(`📊 Run iniciado con ID: ${runId}`);

      // Wait for completion
      let runStatus = 'RUNNING';
      let attempts = 0;
      const maxAttempts = 30; // 5 minutes max wait

      while (runStatus === 'RUNNING' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
        attempts++;

        const statusResponse = await axios.get(
          `${APIFY_API_BASE_URL}/acts/${APIFY_METRICS_ACTOR_ID}/runs/${runId}?token=${APIFY_API_TOKEN}`
        );

        runStatus = statusResponse.data.data.status;
        logger.info(`⏳ Intento ${attempts}/${maxAttempts} - Estado: ${runStatus}`);

        if (runStatus === 'SUCCEEDED') {
          break;
        } else if (runStatus === 'FAILED' || runStatus === 'ABORTED') {
          throw new Error(`Run falló con estado: ${runStatus}`);
        }
      }

      if (runStatus !== 'SUCCEEDED') {
        throw new Error(`Timeout esperando que el run complete. Estado final: ${runStatus}`);
      }

      // Get results
      const resultsResponse = await axios.get(
        `${APIFY_API_BASE_URL}/acts/${APIFY_METRICS_ACTOR_ID}/runs/${runId}/dataset/items?token=${APIFY_API_TOKEN}`
      );

      const results = resultsResponse.data;
      logger.info(`📈 Resultados obtenidos: ${results.length} items`);

      if (!results || results.length === 0) {
        throw new Error('No se encontraron resultados del scraping');
      }

      // Find the tweet that matches our URL
      const tweetId = this.extractTweetIdFromUrl(cleanUrl);
      const result = results.find((item: any) => 
        item.tweet_id === tweetId || 
        item.tweet_id === tweetId.toString()
      );

      if (!result) {
        logger.error(`❌ No se encontró el tweet con ID: ${tweetId}`);
        logger.error(`📋 Tweets disponibles: ${results.map((r: any) => r.tweet_id).join(', ')}`);
        throw new Error(`No se encontró el tweet con ID: ${tweetId}`);
      }

      logger.info(`✅ Tweet encontrado: ${result.tweet_id}`);

      // Map the result to our expected structure
      const mappedResult = {
        tweet_id: result.tweet_id,
        screen_name: result.screen_name,
        text: result.text || '',
        created_at: result.created_at,
        favorites: result.favorites || 0,
        retweets: result.retweets || 0,
        replies: result.replies || 0,
        quotes: result.quotes || 0,
        bookmarks: result.bookmarks || 0,
        views: result.views || '0',
        lang: result.lang || 'en',
        source: result.source || '',
        conversation_id: result.conversation_id || '',
        is_retweet: result.is_retweet || false,
        is_quote: result.is_quote || false,
        is_reply: result.is_reply || false,
        user_info: result.user_info || {
          screen_name: result.screen_name,
          name: '',
          created_at: '',
          description: '',
          rest_id: '',
          followers_count: 0,
          favourites_count: 0,
          avatar: '',
          verified: false,
          friends_count: 0,
          location: null
        },
        entities: result.entities || {
          hashtags: [],
          symbols: [],
          timestamps: [],
          urls: [],
          user_mentions: []
        },
        media: result.media || [],
        engageRate: this.calculateEngagementRate(
          parseInt(result.views) || 0,
          result.favorites || 0,
          result.replies || 0,
          result.retweets || 0,
          result.quotes || 0
        )
      };

      const response: TwitterPostMetrics = {
        data: {
          basicTwitterPost: mappedResult
        },
        error: '',
        success: true,
        quotaUsed: 1,
        timestamp: Date.now(),
        quotaUsedTotal: 1,
        remainingPlanCredit: 9999,
        remainingPrepurchasedCredit: 0
      };

      logger.info(`✅ Métricas obtenidas exitosamente para tweet: ${mappedResult.tweet_id}`);
      logger.info(`📊 Favorites: ${mappedResult.favorites}, Retweets: ${mappedResult.retweets}, Replies: ${mappedResult.replies}, Views: ${mappedResult.views}, Engage Rate: ${(mappedResult.engageRate).toFixed(4)}`);

      return {
        success: true,
        data: response
      };

    } catch (error: any) {
      logger.error(`❌ Error obteniendo métricas de Twitter: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get tweet comments using Apify Twitter Comments Scraper
   */
  async getTweetComments(tweetUrl: string, limit: number = 50): Promise<{
    success: boolean;
    comments?: TwitterComment[];
    error?: string;
    totalComments?: number;
  }> {
    try {
      // Validate API token
      if (!APIFY_API_TOKEN || APIFY_API_TOKEN === 'YOUR_APIFY_API_TOKEN') {
        throw new Error('APIFY_API_TOKEN no configurado. Por favor configura tu token de Apify en el archivo .env');
      }

      const cleanUrl = this.cleanTwitterUrl(tweetUrl);
      logger.info(`🔗 URL original: ${tweetUrl}`);
      logger.info(`🧹 URL limpia: ${cleanUrl}`);

      logger.info(`🚀 Iniciando scraping de comentarios con Apify actor: ${APIFY_COMMENTS_ACTOR_ID}`);

      // Start Apify run
      const runResponse = await axios.post(
        `${APIFY_API_BASE_URL}/acts/${APIFY_COMMENTS_ACTOR_ID}/runs?token=${APIFY_API_TOKEN}`,
        {
          postURLs: [cleanUrl],
          maxRequestRetries: 3,
          maxConcurrency: 1
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const runId = runResponse.data.data.id;
      logger.info(`📊 Run iniciado con ID: ${runId}`);

      // Wait for completion
      let runStatus = 'RUNNING';
      let attempts = 0;
      const maxAttempts = 30; // 5 minutes max wait

      while (runStatus === 'RUNNING' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
        attempts++;

        const statusResponse = await axios.get(
          `${APIFY_API_BASE_URL}/acts/${APIFY_COMMENTS_ACTOR_ID}/runs/${runId}?token=${APIFY_API_TOKEN}`
        );

        runStatus = statusResponse.data.data.status;
        logger.info(`⏳ Intento ${attempts}/${maxAttempts} - Estado: ${runStatus}`);

        if (runStatus === 'SUCCEEDED') {
          break;
        } else if (runStatus === 'FAILED' || runStatus === 'ABORTED') {
          throw new Error(`Run falló con estado: ${runStatus}`);
        }
      }

      if (runStatus !== 'SUCCEEDED') {
        throw new Error(`Timeout esperando que el run complete. Estado final: ${runStatus}`);
      }

      // Get results
      const resultsResponse = await axios.get(
        `${APIFY_API_BASE_URL}/acts/${APIFY_COMMENTS_ACTOR_ID}/runs/${runId}/dataset/items?token=${APIFY_API_TOKEN}`
      );

      const results = resultsResponse.data;
      logger.info(`📈 Resultados obtenidos: ${results.length} items`);

      if (!results || results.length === 0) {
        logger.warn('⚠️ No se encontraron comentarios');
        return {
          success: true,
          comments: [],
          totalComments: 0
        };
      }

      // Map comments to our expected structure
      const mappedComments = results.map((comment: any) => ({
        id: comment.tweet_id || comment.id,
        text: comment.text || '',
        author: comment.screen_name || comment.author || '',
        platform: 'twitter',
        likeCount: comment.favorites || comment.likeCount || 0,
        scrapedAt: new Date().toISOString(),
        replyCount: comment.replies || comment.replyCount || 0,
        publishedAt: comment.created_at || comment.publishedAt || new Date().toISOString(),
        retweetCount: comment.retweets || 0,
        quoteCount: comment.quotes || 0,
        bookmarkCount: comment.bookmarks || 0,
        viewCount: comment.views || '0'
      }));

      // Filter valid comments and apply limit
      const validComments = mappedComments
        .filter((comment: TwitterComment) => comment.text && comment.text.trim().length > 0)
        .slice(0, limit);

      logger.info(`✅ Comentarios obtenidos exitosamente: ${validComments.length}/${mappedComments.length} válidos`);

      return {
        success: true,
        comments: validComments,
        totalComments: validComments.length
      };

    } catch (error: any) {
      logger.error(`❌ Error obteniendo comentarios de Twitter: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Clean Twitter URL to ensure proper format
   */
  private cleanTwitterUrl(url: string): string {
    // Remove any query parameters and fragments
    let cleanUrl = url.split('?')[0]?.split('#')[0] || url;
    
    // Ensure it's a valid Twitter/X URL
    if (!cleanUrl.includes('twitter.com') && !cleanUrl.includes('x.com')) {
      throw new Error('URL no válida de Twitter/X');
    }

    // Convert x.com to twitter.com for consistency
    cleanUrl = cleanUrl.replace('x.com', 'twitter.com');

    return cleanUrl;
  }

  /**
   * Extract tweet ID from URL
   */
  private extractTweetIdFromUrl(url: string): string {
    const match = url.match(/\/status\/(\d+)/);
    if (!match || !match[1]) {
      throw new Error('No se pudo extraer el ID del tweet de la URL');
    }
    return match[1];
  }

  /**
   * Calculate engagement rate for Twitter
   */
  private calculateEngagementRate(views: number, favorites: number, replies: number, retweets: number, quotes: number): number {
    if (views === 0) return 0;
    const totalEngagement = favorites + replies + retweets + quotes;
    const engagementRate = (totalEngagement / views);
    return Math.round(engagementRate * 10000) / 10000; // Round to 4 decimal places for precision
  }

  /**
   * Convert Twitter metrics to system format
   */
  convertToSystemFormat(
    postId: string,
    _tweetUrl: string,
    twitterMetrics: TwitterPostMetrics
  ): any {
    const videoData = twitterMetrics.data.basicTwitterPost;

    return {
      post_id: postId,
      platform: 'twitter',
      content_id: videoData.tweet_id,
      post_url: _tweetUrl,
      title: videoData.text.substring(0, 100) + (videoData.text.length > 100 ? '...' : ''),
      likes_count: videoData.favorites,
      comments_count: videoData.replies,
      views_count: parseInt(videoData.views) || 0,
      engagement_rate: videoData.engageRate,
      platform_data: {
        retweets: videoData.retweets,
        quotes: videoData.quotes,
        bookmarks: videoData.bookmarks,
        lang: videoData.lang,
        source: videoData.source,
        conversation_id: videoData.conversation_id,
        is_retweet: videoData.is_retweet,
        is_quote: videoData.is_quote,
        is_reply: videoData.is_reply,
        user_info: videoData.user_info,
        entities: videoData.entities,
        media: videoData.media
      },
      quota_used: twitterMetrics.quotaUsed,
      api_timestamp: twitterMetrics.timestamp,
      api_success: twitterMetrics.success,
      api_error: twitterMetrics.error,
      raw_response: {
        data: {
          basicTwitterPost: {
            tweet_id: videoData.tweet_id,
            screen_name: videoData.screen_name,
            text: videoData.text,
            created_at: videoData.created_at,
            favorites: videoData.favorites,
            retweets: videoData.retweets,
            replies: videoData.replies,
            quotes: videoData.quotes,
            bookmarks: videoData.bookmarks,
            views: videoData.views,
            lang: videoData.lang,
            source: videoData.source,
            conversation_id: videoData.conversation_id,
            is_retweet: videoData.is_retweet,
            is_quote: videoData.is_quote,
            is_reply: videoData.is_reply,
            user_info: videoData.user_info,
            entities: videoData.entities,
            media: videoData.media,
            engageRate: videoData.engageRate
          }
        },
        error: twitterMetrics.error,
        success: twitterMetrics.success,
        quotaUsed: twitterMetrics.quotaUsed,
        timestamp: twitterMetrics.timestamp,
        quotaUsedTotal: twitterMetrics.quotaUsedTotal,
        remainingPlanCredit: twitterMetrics.remainingPlanCredit,
        remainingPrepurchasedCredit: twitterMetrics.remainingPrepurchasedCredit
      }
    };
  }
} 