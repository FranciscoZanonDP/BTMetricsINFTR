const axios = require('axios');
require('dotenv').config();

const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN;
const APIFY_API_BASE_URL = 'https://api.apify.com/v2';
const APIFY_METRICS_ACTOR_ID = 'pratikdani~twitter-posts-scraper';

async function testApifyConnection() {
  console.log('🔍 Probando conexión con Apify...');
  console.log(`📋 Token: ${APIFY_API_TOKEN ? APIFY_API_TOKEN.substring(0, 10) + '...' : 'NO CONFIGURADO'}`);
  console.log(`🎭 Actor ID: ${APIFY_METRICS_ACTOR_ID}`);
  console.log('---');

  try {
    // Test 1: Verificar token válido
    console.log('1️⃣ Probando autenticación del token...');
    const userResponse = await axios.get(`${APIFY_API_BASE_URL}/users/me?token=${APIFY_API_TOKEN}`);
    console.log('✅ Token válido');
    console.log(`👤 Usuario: ${userResponse.data.username}`);
    console.log(`💰 Plan: ${userResponse.data.plan}`);
    console.log(`💳 Créditos restantes: ${userResponse.data.remainingPlanCredit}`);
    console.log('---');

    // Test 2: Verificar que el actor existe
    console.log('2️⃣ Verificando que el actor existe...');
    const actorResponse = await axios.get(`${APIFY_API_BASE_URL}/acts/${APIFY_METRICS_ACTOR_ID}?token=${APIFY_API_TOKEN}`);
    console.log('✅ Actor encontrado');
    console.log(`📝 Nombre: ${actorResponse.data.name}`);
    console.log(`📊 Versión: ${actorResponse.data.versionNumber}`);
    console.log(`🔄 Estado: ${actorResponse.data.isPublic ? 'Público' : 'Privado'}`);
    console.log('---');

    // Test 3: Verificar límites de uso
    console.log('3️⃣ Verificando límites de uso...');
    const usageResponse = await axios.get(`${APIFY_API_BASE_URL}/users/me/usage?token=${APIFY_API_TOKEN}`);
    console.log('✅ Límites obtenidos');
    console.log(`📊 Uso del mes: ${usageResponse.data.usage}`);
    console.log(`📈 Límite del plan: ${usageResponse.data.limit}`);
    console.log('---');

    // Test 4: Intentar iniciar un run (sin esperar resultados)
    console.log('4️⃣ Probando inicio de run...');
    const testUrl = 'https://twitter.com/emollick/status/1949306100278263912';
    
    const runResponse = await axios.post(
      `${APIFY_API_BASE_URL}/acts/${APIFY_METRICS_ACTOR_ID}/runs?token=${APIFY_API_TOKEN}`,
      {
        postURLs: [testUrl]
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ Run iniciado exitosamente');
    console.log(`🆔 Run ID: ${runResponse.data.data.id}`);
    console.log(`📊 Estado inicial: ${runResponse.data.data.status}`);
    
    // Cancelar el run para no consumir recursos
    await axios.post(`${APIFY_API_BASE_URL}/acts/${APIFY_METRICS_ACTOR_ID}/runs/${runResponse.data.data.id}/abort?token=${APIFY_API_TOKEN}`);
    console.log('🛑 Run cancelado para ahorrar recursos');

  } catch (error) {
    console.error('❌ Error en la prueba:');
    
    if (error.response) {
      console.error(`📊 Status: ${error.response.status}`);
      console.error(`📋 Data:`, error.response.data);
      
      if (error.response.status === 403) {
        console.error('🚫 Error 403 - Posibles causas:');
        console.error('   • Token inválido o expirado');
        console.error('   • Actor no disponible');
        console.error('   • Límites de uso alcanzados');
        console.error('   • Actor requiere configuración adicional');
      }
    } else {
      console.error('🌐 Error de red:', error.message);
    }
  }
}

// Ejecutar la prueba
testApifyConnection(); 