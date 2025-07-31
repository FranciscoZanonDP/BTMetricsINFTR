import cron from 'node-cron';
import dotenv from 'dotenv';
import logger from './config/logger';
import { MetricsBot } from './bot';
import { NotificationService } from './services/notification';

// Cargar variables de entorno
dotenv.config();

// Configuración
const CRON_SCHEDULE = process.env['BOT_CRON_SCHEDULE'] || '0 */2 * * *'; // Cada 2 horas por defecto
const DAYS_THRESHOLD = parseInt(process.env['DAYS_THRESHOLD'] || '2');

// Crear instancia del bot
const bot = new MetricsBot(DAYS_THRESHOLD);

/**
 * Función principal que ejecuta el bot
 */
async function runBot(): Promise<void> {
  try {
    logger.info('🚀 Iniciando Bot de Métricas ITracker');
    logger.info(`⏰ Programado para ejecutarse: ${CRON_SCHEDULE}`);
    logger.info(`📅 Umbral de días: ${DAYS_THRESHOLD}`);
    
    await bot.run();
  } catch (error: any) {
    logger.error('❌ Error en ejecución del bot:', error);
    await NotificationService.sendErrorAlert(error.message, 'Ejecución programada');
  }
}

/**
 * Función para ejecutar el bot una sola vez (para testing)
 */
async function runOnce(): Promise<void> {
  try {
    logger.info('🔄 Ejecutando bot una sola vez (modo test)');
    await bot.runOnce();
    process.exit(0);
  } catch (error: any) {
    logger.error('❌ Error en ejecución única:', error);
    process.exit(1);
  }
}

/**
 * Función para manejar señales de terminación
 */
function gracefulShutdown(signal: string): void {
  logger.info(`📴 Recibida señal ${signal}, cerrando bot...`);
  process.exit(0);
}

// Manejar señales de terminación
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Manejar errores no capturados
process.on('uncaughtException', (error: Error) => {
  logger.error('❌ Error no capturado:', error);
  NotificationService.sendErrorAlert(error.message, 'Error no capturado');
  process.exit(1);
});

process.on('unhandledRejection', (reason: any) => {
  logger.error('❌ Promesa rechazada no manejada:', reason);
  NotificationService.sendErrorAlert(`Promesa rechazada: ${reason}`, 'Promesa no manejada');
  process.exit(1);
});

// Verificar si se debe ejecutar una sola vez
if (process.argv.includes('--once') || process.argv.includes('-o')) {
  runOnce();
} else {
  // Programar ejecución con cron
  logger.info('📅 Programando ejecución con cron...');
  
  cron.schedule(CRON_SCHEDULE, async () => {
    logger.info('⏰ Ejecutando bot programado');
    await runBot();
  }, {
    scheduled: true,
    timezone: 'America/Argentina/Buenos_Aires'
  });

  // Ejecutar inmediatamente al iniciar (opcional)
  if (process.argv.includes('--run-now') || process.argv.includes('-r')) {
    logger.info('🚀 Ejecutando bot inmediatamente...');
    runBot();
  }

  logger.info('✅ Bot programado y ejecutándose. Presiona Ctrl+C para detener.');
  logger.info('💡 Usa --once para ejecutar una sola vez');
  logger.info('💡 Usa --run-now para ejecutar inmediatamente además del cron');
} 