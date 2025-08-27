export interface PostMetrics {
  id?: string;
  post_id: string;
  platform: string;
  content_id: string;
  post_url: string;
  title?: string | null;
  likes_count?: number | null;
  comments_count?: number | null;
  views_count?: number | null;
  engagement_rate?: number | null;
  platform_data?: any | null;
  quota_used?: number | null;
  api_timestamp?: number | null;
  api_success?: boolean | null;
  api_error?: string | null;
  raw_response?: any | null;
  created_at?: string | null;
  updated_at?: string | null;
  comments_analysis?: any | null;
}

export interface InfluencerPost {
  id: string;
  post_url: string;
  platform: string;
  influencer_id: string;
  campaign_id?: string;
  likes_count?: number;
  comments_count?: number;
  views_count?: number;
  engagement_rate?: number;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export interface PostWithLatestMetrics {
  post_id: string;
  platform: string;
  post_url: string;
  latest_metrics_created_at: string;
  days_since_last_update: number;
  influencer_post_id: string;
  influencer_id: string;
  campaign_id: string;
  db_name?: string; // Identificador de la base de datos
}

export interface MetricsUpdateResult {
  post_id: string;
  platform: string;
  success: boolean;
  new_metrics?: any;
  error?: string;
}

export interface PostTopic {
  id?: string;
  post_id: string;
  topic_label: string;
  topic_description?: string | null;
  keywords: string[];
  relevance_score: number;
  confidence_score: number;
  comment_count: number;
  sentiment_distribution?: any | null;
  extracted_method: string;
  language_detected?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
} 