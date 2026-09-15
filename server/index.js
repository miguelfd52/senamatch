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
const miscRoutes     = require('./routes/misc');

const app = express();

// ─── CORS ───────────────────────────────────────────────────────────────────
const isDev = process.env.NODE_ENV !== 'production';
const ALLOWED_ORIGIN_PROD = 'https://senamatch-k9dt.vercel.app';

app.use(cors({
  origin: (origin, callback) => {
    // Permitir peticiones sin origin (apps móviles Expo / React Native, curl, scripts del servidor)
    if (!origin) return callback(null, true);

    // Permitir el frontend de producción en Vercel
    if (origin === ALLOWED_ORIGIN_PROD) {
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
const uri = process.env.MONGO_URI;
const fallbackUri = 'mongodb://127.0.0.1:27017/senamatch';
const candidates = [];

if (uri && !uri.includes('USUARIO') && !uri.includes('CONTRASENA')) {
  candidates.push(uri);
}

if (!candidates.includes(fallbackUri)) {
  candidates.push(fallbackUri);
}

const safeLogUri = (value) => value.replace(
  /mongodb(\+srv)?:\/\/([^:@]+):([^@]+)@/,
  (_, srv) => `mongodb${srv || ''}://***:***@`
);

const connectMongo = async () => {
  let lastError = null;

  for (const candidate of candidates) {
    try {
      await mongoose.connect(candidate, {
        dbName: 'senamatch',
      });
      console.log(`✅ Conectado a MongoDB (base: senamatch): ${safeLogUri(candidate)}`);
      return;
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

  setTimeout(connectMongo, 10_000);
};

connectMongo();

// ─── Rutas ───────────────────────────────────────────────────────────────────
app.use('/auth',     authRoutes);
app.use('/perfiles', perfilesRoutes);
app.use('/swipes',   swipesRoutes);
app.use('/parches',  parchesRoutes);
app.use('/chats',    chatsRoutes);
app.use('/',         miscRoutes); // bloqueos, reportes, config

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
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

// ─── Inicio ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Servidor SENA Match corriendo en puerto ${PORT}`);
});

module.exports = app;
