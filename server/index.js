const path = require('path');
// Carga explícita de server/.env por ruta absoluta: si el proceso se lanza
// desde la raíz del monorepo (p. ej. `node server/index.js`), dotenv.config()
// sin ruta cargaría el `.env` de la raíz —que usa MONGODB_URI/MONGODB_DB, no
// MONGO_URI— dejando MONGO_URI indefinida y abortando el arranque.
require('dotenv').config({ path: path.join(__dirname, '.env') });
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

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(cors());
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
      await mongoose.connect(candidate);
      console.log(`✅ Conectado a MongoDB: ${safeLogUri(candidate)}`);
      return;
    } catch (err) {
      lastError = err;
      console.warn(`⚠️ No se pudo conectar a ${safeLogUri(candidate)}: ${err.message}`);
    }
  }

  console.error(
    '\n❌ No se pudo conectar a MongoDB.\n' +
    '   1) Autoriza la IP del equipo en Atlas, o\n' +
    '   2) inicia MongoDB local con la base "senamatch".\n' +
    `   Último error: ${lastError ? lastError.message : 'desconocido'}`
  );

  // Atlas puede tardar unos instantes en aplicar una nueva regla de acceso.
  // Mantener el proceso vivo y reintentar evita tener que reiniciar el backend
  // manualmente cuando la base de datos vuelva a estar disponible.
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

// ─── 404 ─────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// ─── Inicio ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Servidor SENA Match corriendo en http://localhost:${PORT}`);
});
