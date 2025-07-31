import axios from 'axios';
import logger from '../config/logger';

export interface BotExecutionReport {
  totalPosts: number;
  postsNeedingUpdate?: number;
  postsWithoutMetrics?: number;
  successfulUpdates?: number;
  failedUpdates?: number;
  processingTime?: number;
  status: 'started' | 'completed' | 'error';
}

export class NotificationService {
  private static slackWebhookUrl = process.env['SLACK_WEBHOOK_URL'];

  /**
   * Envía notificación general a Slack
   */
  static async sendSlackNotification(message: string, channel?: string): Promise<void> {
    if (!this.slackWebhookUrl) {
      logger.warn('SLACK_WEBHOOK_URL no configurado, saltando notificación');
      return;
    }

    try {
      const payload = {
        text: message,
        channel: channel || '#general'
      };

      await axios.post(this.slackWebhookUrl, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000
      });

      logger.info('Notificación enviada a Slack');
    } catch (error: any) {
      logger.error('Error enviando notificación a Slack:', error.message);
    }
  }

  /**
   * Envía reporte de ejecución del bot
   */
  static async sendBotExecutionReport(report: BotExecutionReport): Promise<void> {
    if (!this.slackWebhookUrl) {
      logger.warn('SLACK_WEBHOOK_URL no configurado, saltando notificación');
      return;
    }

    try {
      let message = '';

      if (report.status === 'started') {
        message = `🤖 *Bot de Métricas ITracker - Iniciado*\n` +
                 `📊 Total de posts a procesar: ${report.totalPosts}\n` +
                 `🔄 Posts con métricas antiguas: ${report.postsNeedingUpdate}\n` +
                 `❌ Posts sin métricas: ${report.postsWithoutMetrics}\n` +
                 `⏰ Hora: ${new Date().toLocaleString('es-ES')}`;

      } else if (report.status === 'completed') {
        const successRate = report.totalPosts > 0 
          ? ((report.successfulUpdates || 0) / report.totalPosts * 100).toFixed(1)
          : '0';

        message = `✅ *Bot de Métricas ITracker - Completado*\n` +
                 `📊 Total procesados: ${report.totalPosts}\n` +
                 `✅ Exitosos: ${report.successfulUpdates}\n` +
                 `❌ Errores: ${report.failedUpdates}\n` +
                 `📈 Tasa de éxito: ${successRate}%\n` +
                 `⏱️ Tiempo: ${report.processingTime?.toFixed(2)} minutos\n` +
                 `🕐 Hora: ${new Date().toLocaleString('es-ES')}`;

      } else if (report.status === 'error') {
        message = `🚨 *Bot de Métricas ITracker - Error*\n` +
                 `❌ Error en la ejecución del bot\n` +
                 `📊 Posts procesados: ${report.totalPosts}\n` +
                 `⏰ Hora: ${new Date().toLocaleString('es-ES')}`;
      }

      const payload = {
        text: message,
        channel: '#bot-metricas'
      };

      await axios.post(this.slackWebhookUrl, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000
      });

      logger.info('Reporte de ejecución enviado a Slack');
    } catch (error: any) {
      logger.error('Error enviando reporte a Slack:', error.message);
    }
  }

  /**
   * Envía alerta de error
   */
  static async sendErrorAlert(errorMessage: string, context: string): Promise<void> {
    if (!this.slackWebhookUrl) {
      logger.warn('SLACK_WEBHOOK_URL no configurado, saltando notificación');
      return;
    }

    try {
      const message = `🚨 *Error en Bot de Métricas ITracker*\n` +
                     `📋 Contexto: ${context}\n` +
                     `❌ Error: ${errorMessage}\n` +
                     `⏰ Hora: ${new Date().toLocaleString('es-ES')}`;

      const payload = {
        text: message,
        channel: '#bot-metricas'
      };

      await axios.post(this.slackWebhookUrl, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000
      });

      logger.info('Alerta de error enviada a Slack');
    } catch (error: any) {
      logger.error('Error enviando alerta a Slack:', error.message);
    }
  }

  /**
   * Envía notificación de inicio
   */
  static async sendStartNotification(totalPosts: number): Promise<void> {
    await this.sendBotExecutionReport({
      totalPosts,
      status: 'started'
    });
  }
} 