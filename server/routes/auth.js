/**
 * Rutas de autenticación.
 * v2: Contraseña tradicional (bcryptjs) + JWT.
 * Las rutas OTP se mantienen al final para compatibilidad con dev-login.
 */
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { rolPorDominio } = require('../helpers/reglas');
const Perfil = require('../models/Perfil');

const router = express.Router();

// ─── Helpers ────────────────────────────────────────────────────────────────

const CORREOS_VALIDOS = /@gmail\.com$|@misena\.edu\.co$|@sena\.edu\.co$/i;

function rolPorCorreo(correo) {
  if (/@sena\.edu\.co$/i.test(correo)) return 'instructor';
  if (/@misena\.edu\.co$/i.test(correo) || /@gmail\.com$/i.test(correo)) return 'aprendiz';
  return null;
}

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('Variable de entorno JWT_SECRET no configurada');
  }
  return secret;
}

function firmarToken(perfil) {
  const secret = getJwtSecret();
  return jwt.sign(
    { uid: perfil._id, correo: perfil.correo, rol: perfil.rol },
    secret,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function perfilPublico(perfil) {
  return {
    id: perfil._id,
    correo: perfil.correo,
    nombre: perfil.nombre,
    rol: perfil.rol,
    fotoUrl: perfil.foto_url || null,
    primeraPublicacionCompletada: perfil.primera_publicacion_completada === undefined ? true : !!perfil.primera_publicacion_completada,
  };
}

// ─── POST /auth/register ─────────────────────────────────────────────────────

/**
 * Crea una cuenta nueva con nombre, correo y contraseña.
 * Devuelve { token, user }.
 */
router.post('/register', async (req, res) => {
  try {
    const nombre = (req.body.nombre || req.body.name || '').trim();
    const correo = (req.body.email || req.body.correo || '').trim().toLowerCase();
    const password = req.body.password || req.body.contrasena || '';

    // Validaciones básicas
    if (!nombre || nombre.length < 2) {
      return res.status(400).json({ error: 'El nombre debe tener al menos 2 caracteres' });
    }
    if (!CORREOS_VALIDOS.test(correo)) {
      return res.status(400).json({ error: 'Solo se admiten correos @gmail.com, @misena.edu.co o @sena.edu.co' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }

    const foto_url = (req.body.foto_url || req.body.fotoUrl || '').trim();
    if (!foto_url) {
      return res.status(400).json({ error: 'La foto de perfil es obligatoria para nuevos usuarios' });
    }
    if (foto_url.startsWith('data:')) {
      return res.status(400).json({ error: 'No se permiten imágenes en formato base64. Sube la foto mediante Cloudinary.' });
    }

    const hash = await bcrypt.hash(password, 12);

    // Verificar si el correo ya existe
    const existe = await Perfil.findOne({ correo });
    if (existe) {
      // Si la cuenta existía pero no tenía contraseña definida previamente
      if (!existe.password_hash) {
        existe.password_hash = hash;
        existe.nombre = nombre || existe.nombre;
        if (foto_url && !existe.foto_url) existe.foto_url = foto_url;
        if (existe.primera_publicacion_completada === undefined) {
          existe.primera_publicacion_completada = true;
        }
        await existe.save();
        const token = firmarToken(existe);
        return res.status(200).json({ ok: true, token, user: perfilPublico(existe) });
      }
      return res.status(409).json({ error: 'Ya existe una cuenta con ese correo' });
    }

    const rol = rolPorCorreo(correo);
    const id = crypto.randomUUID();

    const perfil = await Perfil.create({
      _id: id,
      correo,
      nombre,
      rol: rol || 'aprendiz',
      estado: 'activo',
      password_hash: hash,
      foto_url,
      primera_publicacion_completada: false,
      creado: new Date(),
      visto: new Date()
    });

    const token = firmarToken(perfil);
    res.status(201).json({ ok: true, token, user: perfilPublico(perfil) });
  } catch (e) {
    console.error('Error en /auth/register:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ─── POST /auth/login ────────────────────────────────────────────────────────

/**
 * Inicia sesión con correo y contraseña.
 * Devuelve { token, user }.
 */
router.post('/login', async (req, res) => {
  try {
    const correo = (req.body.email || req.body.correo || '').trim().toLowerCase();
    const password = req.body.password || req.body.contrasena || '';

    if (!correo || !password) {
      return res.status(400).json({ error: 'Correo y contraseña son obligatorios' });
    }

    const perfil = await Perfil.findOne({ correo }).select('+password_hash');
    if (!perfil || !perfil.password_hash) {
      // Respuesta deliberadamente vaga: no revelar si el correo existe
      return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
    }

    const coincide = await bcrypt.compare(password, perfil.password_hash);
    if (!coincide) {
      return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
    }

    const token = firmarToken(perfil);
    res.json({ ok: true, token, user: perfilPublico(perfil) });
  } catch (e) {
    console.error('Error en /auth/login:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ─── Rutas OTP (mantenidas para compatibilidad) ──────────────────────────────

const otpStore = new Map();

function generarOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

router.post('/otp', async (req, res) => {
  try {
    const correo = (req.body.email || '').trim().toLowerCase();
    const rol = rolPorDominio(correo);
    if (!rol) {
      return res.status(400).json({ error: 'Solo se admiten correos @misena.edu.co o @sena.edu.co' });
    }
    const code = generarOTP();
    otpStore.set(correo, { code, expires: Date.now() + 10 * 60 * 1000 });

    let perfil = await Perfil.findOne({ correo });
    if (!perfil) {
      perfil = await Perfil.create({ _id: crypto.randomUUID(), correo, nombre: correo.split('@')[0], rol });
    }
    console.log(`\n  📧 OTP para ${correo}: ${code}\n`);
    res.json({ ok: true, message: 'Código enviado' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/verify', async (req, res) => {
  try {
    const correo = (req.body.email || '').trim().toLowerCase();
    const token = (req.body.token || '').trim();
    if (!correo || !token) return res.status(400).json({ error: 'Faltan correo o código' });

    const stored = otpStore.get(correo);
    if (!stored) return res.status(400).json({ error: 'No hay código pendiente para ese correo' });
    if (Date.now() > stored.expires) {
      otpStore.delete(correo);
      return res.status(400).json({ error: 'El código expiró' });
    }
    if (stored.code !== token) return res.status(400).json({ error: 'Código incorrecto' });

    otpStore.delete(correo);
    const perfil = await Perfil.findOne({ correo });
    if (!perfil) return res.status(400).json({ error: 'Perfil no encontrado' });

    const jwtToken = firmarToken(perfil);
    res.json({ ok: true, token: jwtToken, user: perfilPublico(perfil) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
