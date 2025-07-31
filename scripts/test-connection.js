#!/usr/bin/env node

/**
 * Script para probar las conexiones del bot
 * Ejecutar: node scripts/test-connection.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const API_BASE_URL = process.env.API_BASE_URL || 'https://influencerstracker-back.vercel.app/api';

async function testSupabaseConnection() {
  console.log('🔍 Probando conexión a Supabase...');
  
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.log('❌ Variables de entorno de Supabase no configuradas');
    return false;
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Probar conexión con una consulta simple
    const { data, error } = await supabase
      .from('post_metrics')
      .select('count')
      .limit(1);

    if (error) {
      console.log('❌ Error conectando a Supabase:', error.message);
      return false;
    }

    console.log('✅ Conexión a Supabase exitosa');
    return true;
  } catch (error) {
    console.log('❌ Error conectando a Supabase:', error.message);
    return false;
  }
}

async function testApiConnection() {
  console.log('🔍 Probando conexión a API...');
  
  try {
    const response = await axios.get(`${API_BASE_URL}/health`, {
      timeout: 10000
    });

    if (response.status === 200) {
      console.log('✅ Conexión a API exitosa');
      console.log('   Status:', response.data.status);
      console.log('   Uptime:', response.data.uptime);
      console.log('   Version:', response.data.version);
      return true;
    } else {
      console.log('❌ API respondió con status:', response.status);
      return false;
    }
  } catch (error) {
    console.log('❌ Error conectando a API:', error.message);
    return false;
  }
}

async function testSlackConnection() {
  console.log('🔍 Probando conexión a Slack...');
  
  const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!slackWebhookUrl) {
    console.log('⚠️  SLACK_WEBHOOK_URL no configurado (opcional)');
    return true;
  }

  try {
    const response = await axios.post(slackWebhookUrl, {
      text: '🧪 Test de conexión desde Bot de Métricas ITracker'
    }, {
      timeout: 10000
    });

    if (response.status === 200) {
      console.log('✅ Conexión a Slack exitosa');
      return true;
    } else {
      console.log('❌ Slack respondió con status:', response.status);
      return false;
    }
  } catch (error) {
    console.log('❌ Error conectando a Slack:', error.message);
    return false;
  }
}

async function testDatabaseQueries() {
  console.log('🔍 Probando consultas de base de datos...');
  
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.log('❌ No se pueden probar consultas sin credenciales de Supabase');
    return false;
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Probar consulta de posts que necesitan actualización
    const { data: postsNeedingUpdate, error: error1 } = await supabase
      .rpc('exec_sql', {
        sql_query: `
          SELECT COUNT(*) as count
          FROM post_metrics 
          WHERE api_success = true
        `,
        params: []
      });

    if (error1) {
      console.log('❌ Error en consulta de post_metrics:', error1.message);
      return false;
    }

    // Probar consulta de influencer_posts
    const { data: influencerPosts, error: error2 } = await supabase
      .from('influencer_posts')
      .select('count')
      .limit(1);

    if (error2) {
      console.log('❌ Error en consulta de influencer_posts:', error2.message);
      return false;
    }

    console.log('✅ Consultas de base de datos exitosas');
    console.log('   - Tabla post_metrics: accesible');
    console.log('   - Tabla influencer_posts: accesible');
    return true;
  } catch (error) {
    console.log('❌ Error en consultas de base de datos:', error.message);
    return false;
  }
}

async function runTests() {
  console.log('🧪 Iniciando pruebas de conexión...\n');

  const results = {
    supabase: await testSupabaseConnection(),
    api: await testApiConnection(),
    slack: await testSlackConnection(),
    database: await testDatabaseQueries()
  };

  console.log('\n📊 Resumen de pruebas:');
  console.log('=====================');
  console.log(`Supabase: ${results.supabase ? '✅' : '❌'}`);
  console.log(`API: ${results.api ? '✅' : '❌'}`);
  console.log(`Slack: ${results.slack ? '✅' : '❌'}`);
  console.log(`Database Queries: ${results.database ? '✅' : '❌'}`);

  const criticalTests = results.supabase && results.api && results.database;
  
  if (criticalTests) {
    console.log('\n🎉 Todas las pruebas críticas pasaron. El bot debería funcionar correctamente.');
    process.exit(0);
  } else {
    console.log('\n❌ Algunas pruebas críticas fallaron. Revisa la configuración antes de ejecutar el bot.');
    process.exit(1);
  }
}

// Ejecutar pruebas
runTests().catch(error => {
  console.error('❌ Error ejecutando pruebas:', error);
  process.exit(1);
}); 