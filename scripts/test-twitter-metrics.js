const { TwitterMetricsService } = require('../src/services/social/twitter-metrics.service');

async function testTwitterMetrics() {
  console.log('🧪 Iniciando pruebas de Twitter Metrics Service...\n');

  const twitterService = TwitterMetricsService.getInstance();

  // Test URL - replace with a real Twitter post URL
  const testTweetUrl = 'https://twitter.com/RayJack97010720/status/1949454780008370515';

  try {
    console.log('📊 Probando obtención de métricas...');
    const metricsResult = await twitterService.getTweetMetrics(testTweetUrl);
    
    if (metricsResult.success) {
      console.log('✅ Métricas obtenidas exitosamente');
      console.log('📈 Datos del tweet:');
      console.log(`   - Tweet ID: ${metricsResult.data.data.basicTwitterPost.tweet_id}`);
      console.log(`   - Usuario: ${metricsResult.data.data.basicTwitterPost.screen_name}`);
      console.log(`   - Favorites: ${metricsResult.data.data.basicTwitterPost.favorites}`);
      console.log(`   - Retweets: ${metricsResult.data.data.basicTwitterPost.retweets}`);
      console.log(`   - Replies: ${metricsResult.data.data.basicTwitterPost.replies}`);
      console.log(`   - Views: ${metricsResult.data.data.basicTwitterPost.views}`);
      console.log(`   - Engage Rate: ${metricsResult.data.data.basicTwitterPost.engageRate}`);
    } else {
      console.log('❌ Error obteniendo métricas:', metricsResult.error);
    }

    console.log('\n💬 Probando obtención de comentarios...');
    const commentsResult = await twitterService.getTweetComments(testTweetUrl, 10);
    
    if (commentsResult.success) {
      console.log('✅ Comentarios obtenidos exitosamente');
      console.log(`📝 Total de comentarios: ${commentsResult.totalComments}`);
      
      if (commentsResult.comments && commentsResult.comments.length > 0) {
        console.log('📋 Primeros comentarios:');
        commentsResult.comments.slice(0, 3).forEach((comment, index) => {
          console.log(`   ${index + 1}. ${comment.author}: ${comment.text.substring(0, 100)}...`);
        });
      }
    } else {
      console.log('❌ Error obteniendo comentarios:', commentsResult.error);
    }

    // Test system format conversion
    if (metricsResult.success) {
      console.log('\n🔄 Probando conversión a formato del sistema...');
      const systemFormat = twitterService.convertToSystemFormat(
        'test-post-id',
        testTweetUrl,
        metricsResult.data
      );
      console.log('✅ Conversión exitosa');
      console.log(`   - Platform: ${systemFormat.platform}`);
      console.log(`   - Content ID: ${systemFormat.content_id}`);
      console.log(`   - Engagement Rate: ${systemFormat.engagement_rate}`);
    }

  } catch (error) {
    console.error('❌ Error en las pruebas:', error.message);
  }
}

// Run the test
testTwitterMetrics().then(() => {
  console.log('\n🏁 Pruebas completadas');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Error fatal:', error);
  process.exit(1);
}); 