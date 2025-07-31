const { TikTokMetricsService } = require('../src/services/social/tiktok-metrics.service');

async function testTikTokMetrics() {
  console.log('🧪 Probando servicio de métricas de TikTok...\n');

  const tiktokService = TikTokMetricsService.getInstance();
  
  // URL de prueba (usar una URL real de TikTok)
  const testUrl = 'https://www.tiktok.com/@akimaguilar/video/7522706278028791058';
  
  try {
    console.log(`📝 Obteniendo métricas para: ${testUrl}`);
    
    const result = await tiktokService.getVideoMetrics(testUrl);
    
    if (result.success) {
      console.log(`✅ Métricas obtenidas exitosamente!`);
      
      const videoData = result.data.data.basicTikTokVideo;
      console.log(`📊 Datos del video:`);
      console.log(`   Video ID: ${videoData.videoId}`);
      console.log(`   Plays: ${videoData.plays}`);
      console.log(`   Hearts: ${videoData.hearts}`);
      console.log(`   Comments: ${videoData.comments}`);
      console.log(`   Shares: ${videoData.shares}`);
      console.log(`   Engage Rate: ${videoData.engageRate}`);
      console.log(`   Duration: ${videoData.length}s`);
      console.log(`   Audio: ${videoData.audioTitle} by ${videoData.audioAuthor}`);
      console.log(`   Hashtags: ${videoData.hashtags.join(', ')}`);
      
      // Probar conversión al formato del sistema
      console.log('\n🔄 Probando conversión al formato del sistema...');
      const systemFormat = tiktokService.convertToSystemFormat('test-post-id', testUrl, result.data);
      console.log(`✅ Convertido al formato del sistema`);
      
      console.log('\n📋 Formato del sistema:');
      console.log(`   Post ID: ${systemFormat.post_id}`);
      console.log(`   Platform: ${systemFormat.platform}`);
      console.log(`   Likes: ${systemFormat.likes_count}`);
      console.log(`   Comments: ${systemFormat.comments_count}`);
      console.log(`   Views: ${systemFormat.views_count}`);
      console.log(`   Engagement Rate: ${systemFormat.engagement_rate}%`);
      console.log(`   Platform Data Engage Rate: ${systemFormat.platform_data.engage_rate}`);
      
    } else {
      console.log(`❌ Error: ${result.error}`);
    }
    
  } catch (error) {
    console.error('💥 Error en la prueba:', error);
  }
}

async function testTikTokComments() {
  console.log('\n🧪 Probando servicio de comentarios de TikTok...\n');

  const tiktokService = TikTokMetricsService.getInstance();
  
  // URL de prueba (usar una URL real de TikTok)
  const testUrl = 'https://www.tiktok.com/@akimaguilar/video/7522706278028791058';
  
  try {
    console.log(`📝 Obteniendo comentarios para: ${testUrl}`);
    
    const result = await tiktokService.getVideoComments(testUrl, 10);
    
    if (result.success) {
      console.log(`✅ Comentarios obtenidos exitosamente!`);
      console.log(`📊 Total de comentarios: ${result.totalComments}`);
      
      if (result.comments && result.comments.length > 0) {
        console.log('\n📋 Primeros 3 comentarios:');
        result.comments.slice(0, 3).forEach((comment, index) => {
          console.log(`\n${index + 1}. ${comment.author}:`);
          console.log(`   Texto: ${comment.text.substring(0, 100)}...`);
          console.log(`   Likes: ${comment.likeCount}`);
          console.log(`   Replies: ${comment.replyCount}`);
          console.log(`   Published: ${comment.publishedAt}`);
        });
      } else {
        console.log('⚠️ No se encontraron comentarios');
      }
    } else {
      console.log(`❌ Error: ${result.error}`);
    }
    
  } catch (error) {
    console.error('💥 Error en la prueba de comentarios:', error);
  }
}

// Ejecutar las pruebas
async function runTests() {
  await testTikTokMetrics();
  await testTikTokComments();
  
  console.log('\n🏁 Pruebas completadas');
  process.exit(0);
}

runTests().catch((error) => {
  console.error('💥 Error fatal:', error);
  process.exit(1);
}); 