const { InstagramCommentsService } = require('../src/services/social/instagram-comments.service');

async function testInstagramComments() {
  console.log('🧪 Probando servicio de comentarios de Instagram...\n');

  const commentsService = InstagramCommentsService.getInstance();
  
  // URL de prueba (usar una URL real de Instagram)
  const testUrl = 'https://www.instagram.com/reel/DMoXLEHRRrb/';
  
  try {
    console.log(`📝 Obteniendo comentarios para: ${testUrl}`);
    
    const result = await commentsService.getPostComments(testUrl, 20);
    
    if (result.success) {
      console.log(`✅ Comentarios obtenidos exitosamente!`);
      console.log(`📊 Total de comentarios: ${result.totalComments}`);
      
      if (result.data && result.data.length > 0) {
        console.log('\n📋 Primeros 3 comentarios:');
        result.data.slice(0, 3).forEach((comment, index) => {
          console.log(`\n${index + 1}. ${comment.ownerUsername}:`);
          console.log(`   Texto: ${comment.text.substring(0, 100)}...`);
          console.log(`   Likes: ${comment.likesCount}`);
          console.log(`   Replies: ${comment.repliesCount}`);
          console.log(`   Timestamp: ${comment.timestamp}`);
        });
        
        // Probar conversión al formato del sistema
        console.log('\n🔄 Probando conversión al formato del sistema...');
        const systemFormat = commentsService.convertToSystemFormat(result.data);
        console.log(`✅ Convertidos ${systemFormat.length} comentarios al formato del sistema`);
        
        if (systemFormat.length > 0) {
          console.log('\n📋 Ejemplo de formato del sistema:');
          const example = systemFormat[0];
          console.log(`   ID: ${example.id}`);
          console.log(`   Author: ${example.author}`);
          console.log(`   Text: ${example.text.substring(0, 50)}...`);
          console.log(`   Platform: ${example.platform}`);
          console.log(`   Like Count: ${example.like_count}`);
        }
      } else {
        console.log('⚠️ No se encontraron comentarios');
      }
    } else {
      console.log(`❌ Error: ${result.error}`);
    }
    
  } catch (error) {
    console.error('💥 Error en la prueba:', error);
  }
}

// Ejecutar la prueba
testInstagramComments().then(() => {
  console.log('\n🏁 Prueba completada');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Error fatal:', error);
  process.exit(1);
}); 