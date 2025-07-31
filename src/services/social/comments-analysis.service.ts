import axios from 'axios';
import logger from '../../config/logger';

// OpenAI API configuration
const OPENAI_API_KEY = process.env['OPENAI_API_KEY'] || 'YOUR_OPENAI_API_KEY';
const OPENAI_API_BASE_URL = 'https://api.openai.com/v1';

export interface CommentAnalysis {
  id: string;
  text: string;
  author: string;
  publishedAt: string;
  likeCount: number;
  replyCount: number;
  platform: 'youtube' | 'instagram' | 'tiktok';
  sentiment?: {
    label: 'positive' | 'negative' | 'neutral';
    score: number;
    confidence: number;
    method: string;
  };
  scrapedAt: string;
}

export interface TopicAnalysis {
  topic_label: string;
  topic_description: string;
  keywords: string[];
  relevance_score: number;
  confidence_score: number;
  comment_count: number;
  sentiment_distribution: {
    positive: number;
    neutral: number;
    negative: number;
  };
  extracted_method: string;
  language_detected: string;
}

export class CommentsAnalysisService {
  private static instance: CommentsAnalysisService;

  static getInstance(): CommentsAnalysisService {
    if (!CommentsAnalysisService.instance) {
      CommentsAnalysisService.instance = new CommentsAnalysisService();
    }
    return CommentsAnalysisService.instance;
  }

  /**
   * Analiza sentimientos de comentarios usando OpenAI
   */
  async analyzeSentiments(comments: string[]): Promise<Array<{
    label: 'positive' | 'negative' | 'neutral';
    score: number;
    confidence: number;
    method: string;
  }>> {
    const results = [];
    
    // Procesar en lotes de 10 para no sobrecargar la API
    const batchSize = 10;
    for (let i = 0; i < comments.length; i += batchSize) {
      const batch = comments.slice(i, i + batchSize);
      
      try {
        const batchResults = await Promise.all(
          batch.map(comment => this.analyzeSingleSentiment(comment))
        );
        results.push(...batchResults);
        
        // Pausa entre lotes
        if (i + batchSize < comments.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        logger.error(`Error analizando sentimientos del lote ${Math.floor(i / batchSize) + 1}:`, error);
        // Agregar resultados neutrales para este lote
        batch.forEach(() => {
          results.push({
            label: 'neutral',
            score: 0.5,
            confidence: 0.1,
            method: 'error-fallback'
          });
        });
      }
    }
    
    return results;
  }

  /**
   * Analiza sentimiento de un comentario individual
   */
  private async analyzeSingleSentiment(text: string): Promise<{
    label: 'positive' | 'negative' | 'neutral';
    score: number;
    confidence: number;
    method: string;
  }> {
    try {
      const cleanText = text.trim();
      if (cleanText.length === 0) {
        return {
          label: 'neutral',
          score: 0.5,
          confidence: 0.1,
          method: 'empty-text'
        };
      }

      const prompt = `Analiza el sentimiento del siguiente comentario de redes sociales.

Comentario: "${cleanText}"

Instrucciones:
- Clasifica como: positive, negative, o neutral
- Considera el contexto de redes sociales (emojis, jerga, ironía)
- Proporciona un score de 0 a 1 (qué tan fuerte es el sentimiento)
- Proporciona un nivel de confianza de 0 a 1

Responde SOLO en formato JSON:
{
  "label": "positive|negative|neutral",
  "score": 0.8,
  "confidence": 0.9,
  "reasoning": "breve explicación"
}`;

      const response = await axios.post(`${OPENAI_API_BASE_URL}/chat/completions`, {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 150,
        temperature: 0.3
      }, {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      if (!response.data?.choices?.[0]?.message?.content) {
        throw new Error('Respuesta vacía de OpenAI');
      }

      const content = response.data.choices[0].message.content;
      const cleanContent = content
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();
      
      const parsed = JSON.parse(cleanContent);
      
      return {
        label: parsed.label as 'positive' | 'negative' | 'neutral',
        score: parsed.score || 0.5,
        confidence: parsed.confidence || 0.5,
        method: 'openai-gpt'
      };

    } catch (error) {
      logger.error('Error analizando sentimiento:', error);
      return {
        label: 'neutral',
        score: 0.5,
        confidence: 0.1,
        method: 'error-fallback'
      };
    }
  }

  /**
   * Analiza temas de comentarios usando OpenAI (replicando la lógica del backend)
   */
  async analyzeTopics(comments: string[]): Promise<TopicAnalysis[]> {
    try {
      // Validar API key
      if (!OPENAI_API_KEY || OPENAI_API_KEY === 'YOUR_OPENAI_API_KEY') {
        logger.error('OpenAI API key no configurada para análisis de temas');
        return this.createFallbackTopics(comments);
      }

      // Filtrar comentarios válidos (igual que el backend)
      const validComments = comments
        .filter(comment => comment && comment.trim().length > 10)
        .slice(0, 30); // Máximo 30 comentarios

      if (validComments.length < 3) {
        logger.warn(`Insuficientes comentarios para análisis de temas: ${validComments.length}`);
        return this.createFallbackTopics(validComments);
      }

      // Limitar comentarios para no exceder límites de tokens
      const limitedComments = validComments.slice(0, 15);
      
      const commentsText = limitedComments.map((comment, index) => 
        `${index + 1}. ${comment}`
      ).join('\n');

      const prompt = `Analiza estos comentarios y extrae EXACTAMENTE 3 temas específicos sobre los que más se habla.

Comentarios:
${commentsText}

INSTRUCCIONES ESPECÍFICAS:
- Identifica los 3 temas principales sobre los que más se habla en los comentarios
- Los temas deben ser específicos y estar basados en el contenido real de los comentarios
- En keywords describe los TIPOS DE COMENTARIOS o PATRONES que encuentras
- Las keywords deben ser descripciones categóricas de lo que hacen o dicen los usuarios

EJEMPLOS de keywords que SÍ quiero:
- "Solicitudes de segunda parte"
- "Comentarios positivos sobre el video"
- "Referencias a personajes históricos mencionados"
- "Usuarios compartiendo experiencias similares"
- "Preguntas sobre detalles específicos"
- "Comparaciones con otros contenidos"

IMPORTANTE: Responde ÚNICAMENTE con un JSON array válido de exactamente 3 elementos.

[
  {
    "topic_label": "Título del tema principal",
    "topic_description": "Descripción de qué se comenta sobre este tema",
    "keywords": ["Tipo de comentario 1", "Patrón de comentario 2", "Categoría de comentario 3"],
    "relevance_score": 0.9,
    "confidence_score": 0.8,
    "comment_count": 12,
    "sentiment_distribution": {
      "positive": 0.6,
      "neutral": 0.3,
      "negative": 0.1
    }
  }
]`;

      const response = await axios.post(`${OPENAI_API_BASE_URL}/chat/completions`, {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 800,
        temperature: 0.3
      }, {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      if (!response.data?.choices?.[0]?.message?.content) {
        throw new Error('Respuesta vacía de OpenAI');
      }

      const content = response.data.choices[0].message.content;
      const cleanContent = content
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();
      
      const topics = JSON.parse(cleanContent);
      
      logger.info(`✅ Análisis de temas exitoso: ${topics.length} temas extraídos`);
      
      return topics.map((topic: any) => ({
        topic_label: topic.topic_label || 'Tema identificado',
        topic_description: topic.topic_description || 'Descripción no disponible',
        keywords: Array.isArray(topic.keywords) ? topic.keywords : [],
        relevance_score: Math.min(Math.max(topic.relevance_score || 0.5, 0), 1),
        confidence_score: Math.min(Math.max(topic.confidence_score || 0.5, 0), 1),
        comment_count: topic.comment_count || Math.floor(limitedComments.length / topics.length),
        sentiment_distribution: {
          positive: Math.min(Math.max(topic.sentiment_distribution?.positive || 0.33, 0), 1),
          neutral: Math.min(Math.max(topic.sentiment_distribution?.neutral || 0.33, 0), 1),
          negative: Math.min(Math.max(topic.sentiment_distribution?.negative || 0.33, 0), 1)
        },
        extracted_method: 'openai-gpt',
        language_detected: 'es'
      }));

    } catch (error) {
      logger.error('Error analizando temas con OpenAI:', error);
      logger.info('Usando fallback para análisis de temas');
      return this.createFallbackTopics(comments);
    }
  }

  /**
   * Crea temas de fallback cuando OpenAI falla
   */
  private createFallbackTopics(comments: string[]): TopicAnalysis[] {
    logger.info('Creando temas de fallback');
    
    const basicKeywords = this.extractBasicKeywords(comments);
    
    return [{
      topic_label: 'Temas principales',
      topic_description: 'Temas principales extraídos automáticamente de los comentarios.',
      keywords: basicKeywords,
      relevance_score: 1.0,
      confidence_score: 0.5,
      comment_count: comments.length,
      sentiment_distribution: { positive: 0.33, neutral: 0.34, negative: 0.33 },
      extracted_method: 'fallback-analysis',
      language_detected: 'es'
    }];
  }

  /**
   * Extrae keywords básicas de los comentarios
   */
  private extractBasicKeywords(comments: string[]): string[] {
    const keywords = [];
    
    // Análisis básico de patrones
    const positiveWords = comments.filter(c => 
      c.toLowerCase().includes('me gusta') || 
      c.toLowerCase().includes('excelente') || 
      c.toLowerCase().includes('bueno') ||
      c.toLowerCase().includes('👍') ||
      c.toLowerCase().includes('❤️')
    ).length;
    
    const questionWords = comments.filter(c => 
      c.includes('?') || 
      c.toLowerCase().includes('cómo') || 
      c.toLowerCase().includes('qué') ||
      c.toLowerCase().includes('cuándo')
    ).length;
    
    const requestWords = comments.filter(c => 
      c.toLowerCase().includes('más') || 
      c.toLowerCase().includes('otro') || 
      c.toLowerCase().includes('segunda parte')
    ).length;

    if (positiveWords > 0) keywords.push('Comentarios positivos');
    if (questionWords > 0) keywords.push('Preguntas de usuarios');
    if (requestWords > 0) keywords.push('Solicitudes de contenido');
    
    if (keywords.length === 0) {
      keywords.push('Interacción general');
    }
    
    return keywords;
  }

  /**
   * Analiza comentarios completos (sentimientos + temas)
   */
  async analyzeComments(comments: CommentAnalysis[]): Promise<{
    comments_analysis: any;
    topics: TopicAnalysis[];
  }> {
    const startTime = Date.now();
    
    try {
      // Extraer textos de comentarios
      const commentTexts = comments.map(c => c.text).filter(Boolean);
      
      if (commentTexts.length === 0) {
        return {
          comments_analysis: {
            comments: [],
            analysis_metadata: {
              analyzed_at: new Date().toISOString(),
              model_used: 'comments-analysis-service',
              processing_time_ms: 0,
              total_comments: 0
            }
          },
          topics: []
        };
      }

      logger.info(`Iniciando análisis de ${commentTexts.length} comentarios`);

      // Analizar sentimientos
      const sentiments = await this.analyzeSentiments(commentTexts);
      
      // Combinar comentarios con sentimientos
      const commentsWithSentiments = comments.map((comment, index) => ({
        ...comment,
        sentiment: sentiments[index] || {
          label: 'neutral',
          score: 0.5,
          confidence: 0.1,
          method: 'fallback'
        }
      }));

      // Analizar temas
      const topics = await this.analyzeTopics(commentTexts);

      const processingTime = Date.now() - startTime;

      logger.info(`✅ Análisis completado en ${processingTime}ms: ${topics.length} temas extraídos`);

      return {
        comments_analysis: {
          comments: commentsWithSentiments,
          analysis_metadata: {
            analyzed_at: new Date().toISOString(),
            model_used: 'comments-analysis-service',
            processing_time_ms: processingTime,
            total_comments: comments.length
          }
        },
        topics
      };

    } catch (error) {
      logger.error('Error en análisis completo de comentarios:', error);
      return {
        comments_analysis: {
          comments: comments.map(c => ({ ...c, sentiment: { label: 'neutral', score: 0.5, confidence: 0.1, method: 'error-fallback' } })),
          analysis_metadata: {
            analyzed_at: new Date().toISOString(),
            model_used: 'comments-analysis-service-error',
            processing_time_ms: Date.now() - startTime,
            total_comments: comments.length
          }
        },
        topics: this.createFallbackTopics(comments.map(c => c.text))
      };
    }
  }
} 