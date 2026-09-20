const path = require('path');

// En entorno local o herramientas de prueba, intentar cargar server/.env
try {
  require('dotenv').config({ path: path.join(__dirname, '../server/.env') });
} catch (e) {
  // Ignorar en producción donde Vercel inyecta las variables de entorno directamente
}

const app = require('../server/index.js');

module.exports = app;
