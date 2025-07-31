# 🤖 Bot de Métricas ITracker

Bot automatizado para actualizar métricas de posts de influencers en las plataformas Instagram, TikTok y YouTube.

## ✨ Características

- **🔄 Actualización Automática**: Ejecuta cada 2 horas automáticamente
- **📊 Múltiples Plataformas**: Soporta Instagram, TikTok y YouTube
- **🎯 Detección Inteligente**: Identifica posts que necesitan actualización
- **📝 Logging Completo**: Registra todas las operaciones
- **🔔 Notificaciones**: Envía reportes a Slack (opcional)
- **🚀 Independiente**: No depende del backend, usa APIs directamente

## 🏗️ Arquitectura

```
BotMetricasIT/
├── src/
│   ├── services/
│   │   ├── social/                    # Servicios de métricas por plataforma
│   │   │   ├── tiktok-metrics.service.ts
│   │   │   ├── instagram-metrics.service.ts
│   │   │   ├── instagram-comments.service.ts
│   │   │   ├── youtube-metrics.service.ts
│   │   │   ├── post-metrics.service.ts
│   │   │   └── comments-analysis.service.ts
│   │   ├── database.ts                # Interacción con Supabase
│   │   └── notification.ts            # Notificaciones Slack
│   ├── config/
│   │   ├── database.ts                # Configuración Supabase
│   │   └── logger.ts                  # Configuración Winston
│   ├── types/
│   │   └── database.ts                # Tipos TypeScript
│   ├── bot.ts                         # Lógica principal del bot
│   └── index.ts                       # Punto de entrada
├── scripts/
│   ├── install.sh                     # Instalación automática
│   └── test-connection.js             # Pruebas de conexión
└── logs/                              # Archivos de log
```

## 📋 Requisitos

- Node.js 18+ 
- npm o yarn
- Cuentas de API:
  - **Apify** (Instagram y TikTok)
- **YouTube Data API** (YouTube)
- **Supabase** (Base de datos)

## 🚀 Instalación

### 1. Clonar y configurar

```bash
cd BotMetricasIT
npm install
```

### 2. Configurar variables de entorno

```bash
cp env.example .env
```

Editar `.env` con tus credenciales:

```env
# Supabase
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_KEY=tu-service-key

# APIs de métricas
APIFY_API_TOKEN=tu-apify-token
YOUTUBE_API_KEY=tu-youtube-key

# Configuración del bot
BOT_CRON_SCHEDULE=0 */2 * * *
DAYS_THRESHOLD=7

# Notificaciones (opcional)
SLACK_WEBHOOK_URL=tu-slack-webhook
```

### 3. Instalación automática (opcional)

```bash
chmod +x scripts/install.sh
./scripts/install.sh
```

## 🎯 Funcionalidad

### ¿Qué hace el bot?

1. **🔍 Busca posts que necesitan actualización**:
   - Posts con métricas de más de 7 días
   - Posts sin métricas exitosas

2. **📊 Obtiene métricas actualizadas**:
   - **Instagram**: Usa Apify Instagram Scraper
   - **TikTok**: Usa Apify TikTok Scraper
   - **YouTube**: Usa YouTube Data API

3. **💬 Obtiene comentarios** (opcional):
   - **Instagram**: Usa Apify Instagram Comment Scraper
   - Análisis de sentimientos con OpenAI
   - Extracción de temas principales
   - **YouTube**: Usa YouTube Data API

3. **💾 Guarda en la base de datos**:
   - Inserta nuevas métricas en `post_metrics`
   - Actualiza métricas en `influencer_posts`

4. **📝 Genera reportes**:
   - Logs detallados
   - Notificaciones Slack (opcional)

### Flujo de trabajo

```
1. Ejecución programada (cada 2h)
   ↓
2. Consulta posts antiguos en Supabase
   ↓
3. Para cada post:
   ├── Extrae ID de la URL
   ├── Llama a la API correspondiente
   ├── Convierte a formato del sistema
   └── Guarda en base de datos
   ↓
4. Genera reporte final
```

## 🛠️ Uso

### Ejecución manual

```bash
# Una sola vez (testing)
npm run dev -- --once

# Ejecutar ahora
npm run dev -- --run-now

# Modo desarrollo
npm run dev
```

### Ejecución programada

```bash
# Iniciar con cron
npm start
```

### Scripts disponibles

```bash
npm run build      # Compilar TypeScript
npm run start      # Ejecutar en producción
npm run dev        # Ejecutar en desarrollo
npm run test       # Ejecutar tests
npm run lint       # Verificar código
npm run format     # Formatear código
```

### Pruebas de comentarios

```bash
# Probar servicio de comentarios de Instagram
node scripts/test-instagram-comments.js

# Probar servicio de métricas y comentarios de TikTok
node scripts/test-tiktok-metrics.js
```

## 📊 APIs Utilizadas

### Instagram (Apify)
- **Actor**: `nH2AHrwxeTRJoN5hX` (Instagram Scraper)
- **Datos**: Likes, comentarios, views, engagement rate, hashtags, mentions
- **Costo**: ~$0.05 por consulta

### Instagram Comments (Apify)
- **Actor**: `apify~instagram-comment-scraper` (SbK00X0JYCPblD2wp)
- **Datos**: Comentarios detallados, autores, likes, replies, timestamps
- **Costo**: ~$0.03 por consulta

### TikTok (Apify)
- **Actor**: `clockworks~tiktok-scraper` (GdWCkxBtKWOsKjdch)
- **Datos**: Views, likes, comentarios, shares, engage rate, audio info, hashtags
- **Costo**: ~$0.05 por consulta

### TikTok Comments (Apify)
- **Actor**: `clockworks~tiktok-comments-scraper` (BDec00yAmCm1QbMEI)
- **Datos**: Comentarios detallados, autores, likes, replies, timestamps
- **Costo**: ~$0.03 por consulta

### YouTube (YouTube Data API)
- **Endpoint**: `https://www.googleapis.com/youtube/v3/videos`
- **Datos**: Views, likes, comentarios, duración
- **Costo**: Gratis (cuota diaria)

## 🔧 Configuración

### Variables de entorno

| Variable | Descripción | Requerido |
|----------|-------------|-----------|
| `SUPABASE_URL` | URL de Supabase | ✅ |
| `SUPABASE_SERVICE_KEY` | Service key de Supabase | ✅ |
| `APIFY_API_TOKEN` | Token de Apify (para Instagram y TikTok) | ✅ |
| `YOUTUBE_API_KEY` | API key de YouTube | ✅ |
| `BOT_CRON_SCHEDULE` | Programación cron | ❌ |
| `DAYS_THRESHOLD` | Días para actualización | ❌ |
| `SLACK_WEBHOOK_URL` | Webhook de Slack | ❌ |

### Programación Cron

```bash
# Cada 2 horas
0 */2 * * *

# Cada hora
0 * * * *

# Cada 6 horas
0 */6 * * *

# Una vez al día a las 2 AM
0 2 * * *
```

## 📝 Logs

Los logs se guardan en:
- **Archivo**: `./logs/bot.log`
- **Consola**: Salida en tiempo real
- **Rotación**: Máximo 5 archivos de 5MB cada uno

### Niveles de log

- `error`: Errores críticos
- `warn`: Advertencias
- `info`: Información general
- `debug`: Información detallada

## 🔍 Monitoreo

### Verificar estado

```bash
# Ver logs en tiempo real
tail -f logs/bot.log

# Ver últimos 100 logs
tail -n 100 logs/bot.log

# Buscar errores
grep "ERROR" logs/bot.log
```

### Métricas de rendimiento

El bot registra:
- Tiempo de procesamiento por post
- Tasa de éxito/error
- Uso de APIs
- Tiempo total de ejecución

## 🚨 Solución de problemas

### Errores comunes

1. **Error de conexión a Supabase**
   ```bash
   # Verificar URL y service key
   npm run test:connection
   ```

2. **Error de API key**
   ```bash
   # Verificar variables de entorno
   echo $CREATORDB_API_KEY
   echo $APIFY_API_TOKEN
   echo $YOUTUBE_API_KEY
   ```

3. **Posts no encontrados**
   ```bash
   # Verificar consultas en logs
   grep "Encontrados" logs/bot.log
   ```

### Debugging

```bash
# Modo debug
LOG_LEVEL=debug npm run dev -- --once

# Ver queries SQL
grep "SELECT" logs/bot.log
```

## 🚀 Despliegue

### Servidor local

```bash
npm run build
npm start
```

### Docker (opcional)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
CMD ["npm", "start"]
```

### PM2 (recomendado)

```bash
npm install -g pm2
pm2 start dist/index.js --name "bot-metricas"
pm2 save
pm2 startup
```

## 📞 Soporte

### Logs de error

Si encuentras problemas:

1. Revisa los logs: `tail -f logs/bot.log`
2. Verifica las variables de entorno
3. Prueba la conexión: `npm run test:connection`
4. Ejecuta en modo debug: `LOG_LEVEL=debug npm run dev -- --once`

### Contacto

Para soporte técnico, revisa los logs y proporciona:
- Fecha y hora del error
- Log completo del error
- Configuración de variables de entorno (sin valores sensibles)

---

**🎉 ¡El bot está listo para mantener tus métricas actualizadas automáticamente!**
