import MongoConnection from './conexion';

async function initDatabase() {
  try {
    console.log('Inicializando base de datos...');
    const { db } = await MongoConnection.connect();

    // Colecciones requeridas por la arquitectura
    const collectionsToCreate = [
      'users',
      'profiles',
      'likes',
      'matches',
      'messages',
      'parches'
    ];

    const existingCollections = await db.listCollections().toArray();
    const existingNames = existingCollections.map(c => c.name);

    for (const name of collectionsToCreate) {
      if (!existingNames.includes(name)) {
        await db.createCollection(name);
        console.log(`✅ Colección creada: ${name}`);
      } else {
        console.log(`ℹ️ La colección ya existe: ${name}`);
      }
    }

    // Configurar índices básicos para asegurar integridad
    console.log('Configurando índices básicos...');
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    await db.collection('profiles').createIndex({ userId: 1 }, { unique: true });
    await db.collection('parches').createIndex({ anfitrion: 1 });

    console.log('🚀 Inicialización completada exitosamente.');
    console.log('El proyecto SENA Match ahora tiene preparada la base de datos MongoDB.');
    
    // Cerrar la conexión
    await MongoConnection.close();
  } catch (error) {
    console.error('❌ Fallo la inicialización de la base de datos:', error);
    process.exit(1);
  }
}

// Ejecutar si se llama directamente mediante tsx o ts-node
if (require.main === module) {
  initDatabase();
}
