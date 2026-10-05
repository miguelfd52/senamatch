const jwt = require('jsonwebtoken');
const Perfil = require('../models/Perfil');

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('Variable de entorno JWT_SECRET no configurada');
  }
  return secret;
};

/**
 * Middleware de autenticación JWT.
 * Extrae el token del header Authorization: Bearer <token>,
 * verifica la firma y adjunta req.uid y req.perfil.
 */
async function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Sin sesión' });
  }
  try {
    const secret = getJwtSecret();
    const token = header.split(' ')[1];
    const payload = jwt.verify(token, secret);
    req.uid = payload.uid || payload.sub;
    req.perfil = await Perfil.findById(req.uid).lean({ virtuals: true });
    next();
  } catch (e) {
    if (e.message && e.message.includes('JWT_SECRET')) {
      return res.status(500).json({ error: 'Error de configuración en el servidor' });
    }
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

/**
 * Middleware opcional: pasa aunque no haya token (para endpoints que funcionan
 * en modo anónimo pero se enriquecen si hay sesión).
 */
async function authOpcional(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    req.uid = null;
    req.perfil = null;
    return next();
  }
  try {
    const token = header.split(' ')[1];
    const payload = jwt.verify(token, getJwtSecret());
    req.uid = payload.uid;
    req.perfil = await Perfil.findById(payload.uid).lean({ virtuals: true });
  } catch (e) {
    req.uid = null;
    req.perfil = null;
  }
  next();
}

module.exports = { auth, authOpcional };
