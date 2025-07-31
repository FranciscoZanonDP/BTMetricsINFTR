import winston from 'winston';
import path from 'path';
import fs from 'fs';

const logLevel = process.env['LOG_LEVEL'] || 'info';
const logFile = process.env['LOG_FILE'] || './logs/bot.log';

// Crear directorio de logs si no existe
const logDir = path.dirname(logFile);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'bot-metricas' },
  transports: [
    new winston.transports.File({ 
      filename: logFile,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ],
});

export default logger; 