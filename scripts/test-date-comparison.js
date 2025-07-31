const { DatabaseService } = require('../src/services/database');

async function testDateComparison() {
  console.log('🧪 Probando nueva lógica de comparación de fechas...\n');

  try {
    // Probar con diferentes umbrales
    const thresholds = [1, 2, 3, 7];
    
    for (const threshold of thresholds) {
      console.log(`📊 Probando con umbral de ${threshold} días:`);
      
      const posts = await DatabaseService.getPostsNeedingUpdate(threshold);
      
      console.log(`   Encontrados ${posts.length} posts que necesitan actualización`);
      
      if (posts.length > 0) {
        console.log(`   📋 Primeros 3 posts:`);
        posts.slice(0, 3).forEach((post, index) => {
          const metricDate = new Date(post.latest_metrics_created_at);
          const today = new Date();
          
          // Comparar solo fecha sin hora
          const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
          const metricDateOnly = new Date(metricDate.getFullYear(), metricDate.getMonth(), metricDate.getDate());
          
          const timeDiff = todayDateOnly.getTime() - metricDateOnly.getTime();
          const daysSinceUpdate = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
          
          console.log(`      ${index + 1}. Post ID: ${post.post_id}`);
          console.log(`         Fecha métrica: ${metricDateOnly.toISOString().split('T')[0]} (${daysSinceUpdate} días atrás)`);
          console.log(`         Platform: ${post.platform}`);
          console.log(`         URL: ${post.post_url.substring(0, 50)}...`);
        });
      }
      console.log('');
    }

    // Probar posts sin métricas
    console.log('📊 Probando posts sin métricas:');
    const postsWithoutMetrics = await DatabaseService.getPostsWithoutMetrics();
    console.log(`   Encontrados ${postsWithoutMetrics.length} posts sin métricas`);
    
    if (postsWithoutMetrics.length > 0) {
      console.log(`   📋 Primeros 3 posts:`);
      postsWithoutMetrics.slice(0, 3).forEach((post, index) => {
        console.log(`      ${index + 1}. Post ID: ${post.post_id}`);
        console.log(`         Platform: ${post.platform}`);
        console.log(`         URL: ${post.post_url.substring(0, 50)}...`);
      });
    }

  } catch (error) {
    console.error('❌ Error en prueba:', error.message);
  }
}

// Ejecutar prueba
testDateComparison().then(() => {
  console.log('✅ Prueba completada');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
}); 