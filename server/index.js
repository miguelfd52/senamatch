const path = require('path');
// Carga de variables de entorno (server/.env en local, o entorno del host en la nube)
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

// ─── Rutas ──────────────────────────────────────────────────────────────────
const authRoutes     = require('./routes/auth');
const perfilesRoutes = require('./routes/perfiles');
const swipesRoutes   = require('./routes/swipes');
const parchesRoutes  = require('./routes/parches');
const chatsRoutes    = require('./routes/chats');
const publicacionesRoutes = require('./routes/publicaciones');
const notificacionesRoutes = require('./routes/notificaciones');
const adminRoutes         = require('./routes/admin');
const miscRoutes          = require('./routes/misc');

process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

const app = express();

// ─── CORS ───────────────────────────────────────────────────────────────────
const isDev = process.env.NODE_ENV !== 'production';
const ALLOWED_ORIGIN_PROD = 'https://senamatch-k9dt.vercel.app';

app.use(cors({
  origin: (origin, callback) => {
    // Permitir peticiones sin origin (apps móviles Expo / React Native, curl, scripts del servidor)
    if (!origin) return callback(null, true);

    // Permitir el frontend de producción en Vercel y despliegues preview
    if (origin === ALLOWED_ORIGIN_PROD || origin.endsWith('.vercel.app')) {
      return callback(null, true);
    }

    // Permitir localhost solo en desarrollo
    if (isDev) {
      const isLocalhost = (
        origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:') ||
        /^http:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(origin)
      );
      if (isLocalhost) {
        return callback(null, true);
      }
    }

    // Origen adicional configurable mediante variable de entorno
    if (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL) {
      return callback(null, true);
    }

    return callback(new Error(`Bloqueado por CORS: origen '${origin}' no permitido`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

// ─── Conexión a MongoDB ──────────────────────────────────────────────────────
const getMongoUri = () => {
  const envUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (envUri && !envUri.includes('USUARIO') && !envUri.includes('CONTRASENA')) {
    return envUri;
  }
  if (!process.env.VERCEL && process.env.NODE_ENV !== 'production') {
    return 'mongodb://127.0.0.1:27017/senamatch';
  }
  return null;
};

let isConnecting = null;

const connectMongo = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }
  if (isConnecting) {
    return isConnecting;
  }

  isConnecting = (async () => {
    const uri = getMongoUri();
    if (!uri) {
      const msg = 'Variable de entorno MONGO_URI (o MONGODB_URI) no configurada';
      console.error(`\n❌ Error de configuración: ${msg}. Debe configurarse en las variables de entorno.\n`);
      throw new Error(msg);
    }

    try {
      await mongoose.connect(uri, {
        dbName: 'senamatch',
        serverSelectionTimeoutMS: 8000,
        connectTimeoutMS: 8000,
      });
      console.log('✅ Conectado a MongoDB (base: senamatch)');
      return mongoose.connection;
    } catch (err) {
      console.error('❌ Error al conectar a MongoDB:', err.message);
      if (!process.env.VERCEL) {
        setTimeout(connectMongo, 10_000);
      }
      throw err;
    }
  })().finally(() => {
    isConnecting = null;
  });

  return isConnecting;
};

const ensureMongoConnected = async () => {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  return connectMongo();
};

// Iniciar intento de conexión al arrancar
connectMongo().catch(() => {});

// Middleware para asegurar que MongoDB esté conectado antes de procesar rutas
app.use(async (req, res, next) => {
  if (req.path === '/' || req.path === '/api' || req.path === '/health' || req.path === '/api/health') {
    return next();
  }
  try {
    await ensureMongoConnected();
    next();
  } catch (err) {
    console.error('Error al conectar con MongoDB:', err.message);
    res.status(503).json({ error: 'Error de conexión con la base de datos. Inténtalo nuevamente.' });
  }
});

// ─── Rutas (compatibilidad directa y con prefijo /api) ────────────────────────
const mountRoutes = (prefix = '') => {
  app.use(`${prefix}/auth`,          authRoutes);
  app.use(`${prefix}/perfiles`,      perfilesRoutes);
  app.use(`${prefix}/swipes`,        swipesRoutes);
  app.use(`${prefix}/parches`,       parchesRoutes);
  app.use(`${prefix}/chats`,         chatsRoutes);
  app.use(`${prefix}/publicaciones`, publicacionesRoutes);
  app.use(`${prefix}/notificaciones`, notificacionesRoutes.router);
  app.use(`${prefix}/admin`,         adminRoutes);
  app.use(`${prefix}/matches`,       swipesRoutes);
  app.use(`${prefix}/`,              miscRoutes);
};

mountRoutes('');
mountRoutes('/api');

// ─── Health check ────────────────────────────────────────────────────────────
app.get(['/', '/api', '/health', '/api/health'], async (req, res) => {
  let dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  if (dbStatus !== 'connected' && getMongoUri()) {
    try {
      await ensureMongoConnected();
      dbStatus = 'connected';
    } catch (e) {
      dbStatus = 'error_connecting';
    }
  }

  res.json({
    status: 'ok',
    name: 'sena-match-server',
    database: dbStatus,
    config: {
      mongoUriConfigured: !!getMongoUri(),
      jwtSecretConfigured: !!process.env.JWT_SECRET,
    },
    timestamp: new Date().toISOString()
  });
});

// ─── 404 ─────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// ─── Manejo de errores (CORS y otros) ─────────────────────────────────────────
app.use((err, req, res, next) => {
  if (err.message && err.message.includes('CORS')) {
    return res.status(403).json({ error: err.message });
  }
  console.error('Error no controlado:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// ─── Inicio (solo cuando se ejecuta como script independiente, no en Vercel) ──
const PORT = process.env.PORT || 3001;
if (process.env.VERCEL !== '1' && require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Servidor SENA Match corriendo en puerto ${PORT}`);
  });
}

module.exports = app;
