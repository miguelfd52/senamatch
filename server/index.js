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

// Fallbacks por defecto para entorno Vercel Serverless
const ATLAS_DEFAULT_URI = 'mongodb+srv://migy1kdg_db_user:uxxu9PQKhMReLtmO@senamatch.laom9mq.mongodb.net/senamatch?retryWrites=true&w=majority&appName=Cluster0';
const DEFAULT_JWT_SECRET = 'ed19d6b289cb17ca6ed7df448effcc4a045a6449ac5b3f3ae072e79b76cc16032c610689cffc80f8b708005a8d096771';

process.env.JWT_SECRET = process.env.JWT_SECRET || DEFAULT_JWT_SECRET;
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
const envUri = process.env.MONGO_URI || process.env.MONGODB_URI;
const fallbackLocalUri = 'mongodb://127.0.0.1:27017/senamatch';
const candidates = [];

if (envUri && !envUri.includes('USUARIO') && !envUri.includes('CONTRASENA')) {
  candidates.push(envUri);
}

if (!candidates.includes(ATLAS_DEFAULT_URI)) {
  candidates.push(ATLAS_DEFAULT_URI);
}

if (!process.env.VERCEL && !candidates.includes(fallbackLocalUri)) {
  candidates.push(fallbackLocalUri);
}

const safeLogUri = (value) => value.replace(
  /mongodb(\+srv)?:\/\/([^:@]+):([^@]+)@/,
  (_, srv) => `mongodb${srv || ''}://***:***@`
);

let isConnecting = null;

const connectMongo = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }
  if (isConnecting) {
    return isConnecting;
  }

  isConnecting = (async () => {
    let lastError = null;

    for (const candidate of candidates) {
      try {
        await mongoose.connect(candidate, {
          dbName: 'senamatch',
          serverSelectionTimeoutMS: 5000,
          connectTimeoutMS: 5000,
        });
        console.log(`✅ Conectado a MongoDB (base: senamatch): ${safeLogUri(candidate)}`);
        return mongoose.connection;
      } catch (err) {
        lastError = err;
        console.warn(`⚠️ No se pudo conectar a ${safeLogUri(candidate)}: ${err.message}`);
      }
    }

    console.error(
      '\n❌ No se pudo conectar a MongoDB.\n' +
      '   1) Verifica la variable MONGO_URI y autoriza la IP (0.0.0.0/0) en Atlas, o\n' +
      '   2) inicia MongoDB local con la base "senamatch".\n' +
      `   Último error: ${lastError ? lastError.message : 'desconocido'}`
    );

    if (!process.env.VERCEL) {
      setTimeout(connectMongo, 10_000);
    }
    throw lastError || new Error('No se pudo conectar a MongoDB');
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
  if (req.path === '/' || req.path === '/api') {
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
app.get(['/', '/api'], (req, res) => {
  res.json({
    status: 'ok',
    name: 'sena-match-server',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'connecting_or_disconnected',
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
