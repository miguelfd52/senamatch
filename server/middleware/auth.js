const jwt = require('jsonwebtoken');
const Perfil = require('../models/Perfil');

const DEFAULT_JWT_SECRET = 'ed19d6b289cb17ca6ed7df448effcc4a045a6449ac5b3f3ae072e79b76cc16032c610689cffc80f8b708005a8d096771';
const getJwtSecret = () => process.env.JWT_SECRET || DEFAULT_JWT_SECRET;

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
    const token = header.split(' ')[1];
    const payload = jwt.verify(token, getJwtSecret());
    req.uid = payload.uid || payload.sub;
    req.perfil = await Perfil.findById(req.uid).lean({ virtuals: true });
    next();
  } catch (e) {
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
