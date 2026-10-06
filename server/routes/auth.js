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
const OtpToken = require('../models/OtpToken');

const router = express.Router();

// ─── Helpers ────────────────────────────────────────────────────────────────

const CORREOS_VALIDOS = /^[a-zA-Z0-9._%+-]+@(gmail\.com|misena\.edu\.co|sena\.edu\.co)$/i;

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

/** Genera código numérico de 6 dígitos criptográficamente seguro (100000 - 999999) */
function generarCodigoSeguro() {
  return String(crypto.randomInt(100000, 1000000));
}

// Mapas in-memory de respaldo/fallback y para testing sincrónico
const pendingRegistrations = new Map();
const otpStore = new Map();
const loginAttempts = new Map(); // Para limitar fuerza bruta en login

let nodemailer;
try {
  nodemailer = require('nodemailer');
} catch (e) {
  // Opcional si no está instalado
}

async function enviarCodigoVerificacion(correo, code) {
  if (process.env.NODE_ENV === 'test') {
    return { simulated: true };
  }

  const proveedor = (process.env.EMAIL_PROVIDER || '').trim().toLowerCase();
  const brevoApiKey = process.env.BREVO_API_KEY;
  const brevoSenderEmail = process.env.BREVO_SENDER_EMAIL;
  const usarBrevo = proveedor === 'brevo' || Boolean(brevoApiKey || brevoSenderEmail);

  const textContent = `Tu código de verificación para completar tu registro en SENA Match es: ${code}. Es válido por 15 minutos.`;
  const htmlContent = `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #e0e0e0; border-radius: 12px;">
        <h2 style="color: #39A900; margin-top: 0;">SENA Match</h2>
        <p style="font-size: 15px; color: #333;">Hola,</p>
        <p style="font-size: 15px; color: #333;">Introduce el siguiente código de verificación para completar la creación de tu cuenta en SENA Match:</p>
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; font-size: 28px; font-weight: bold; text-align: center; padding: 14px; letter-spacing: 6px; border-radius: 8px; margin: 20px 0;">
          ${code}
        </div>
        <p style="font-size: 13px; color: #666;">Este código es de un solo uso y vencerá en 15 minutos.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 12px; color: #888; text-align: center; margin: 0;">SENA Match · Creado por Miguel Toncel Herrera</p>
      </div>
    `;

  if (usarBrevo) {
    if (!brevoApiKey || !brevoSenderEmail) {
      throw crearErrorCorreo('EMAIL_CONFIGURATION_MISSING');
    }

    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'api-key': brevoApiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: 'SENA Match', email: brevoSenderEmail },
          to: [{ email: correo }],
          subject: 'Tu código de verificación de SENA Match',
          textContent,
          htmlContent,
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw crearErrorCorreo(`EMAIL_API_REJECTED_${response.status}`);
      }

      return { provider: 'brevo' };
    } catch (error) {
      if (error?.code?.startsWith('EMAIL_')) throw error;
      throw crearErrorCorreo('EMAIL_API_UNAVAILABLE', error);
    }
  }

  if (process.env.SMTP_USER && process.env.SMTP_PASS && nodemailer) {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });

    try {
      await transporter.sendMail({
        from: `"SENA Match" <${process.env.SMTP_USER}>`,
        to: correo,
        subject: 'Tu código de verificación de SENA Match',
        text: textContent,
        html: htmlContent,
      });
      return { provider: 'smtp' };
    } catch (error) {
      throw crearErrorCorreo('EMAIL_SMTP_FAILED', error);
    }
  }

  if (process.env.NODE_ENV === 'production') {
    throw crearErrorCorreo('EMAIL_CONFIGURATION_MISSING');
  }

  // Entorno local: simular envío sin exponer secretos.
  return { simulated: true };
}

function crearErrorCorreo(code, cause) {
  const error = new Error(code, cause ? { cause } : undefined);
  error.code = code;
  return error;
}

function esErrorCorreo(error) {
  return Boolean(error?.code?.startsWith('EMAIL_')) || /SMTP/i.test(error?.message || '');
}

// ─── Helpers de persistencia para OTP y Registros ──────────────────────────

async function getStoredRegistration(correo) {
  try {
    const doc = await OtpToken.findOne({ correo, tipo: 'registro' });
    if (doc) {
      return {
        correo: doc.correo,
        nombre: doc.nombre,
        rol: doc.rol,
        hash: doc.hash,
        foto_url: doc.foto_url,
        code: doc.code,
        intentos: doc.intentos,
        lastSent: doc.lastSent ? new Date(doc.lastSent).getTime() : Date.now(),
        expires: new Date(doc.expiresAt).getTime(),
      };
    }
  } catch (_) {}
  return pendingRegistrations.get(correo) || null;
}

async function saveStoredRegistration(correo, data) {
  pendingRegistrations.set(correo, data);
  try {
    await OtpToken.findOneAndUpdate(
      { correo, tipo: 'registro' },
      {
        correo,
        tipo: 'registro',
        code: data.code,
        nombre: data.nombre,
        rol: data.rol,
        hash: data.hash,
        foto_url: data.foto_url,
        intentos: data.intentos || 0,
        lastSent: new Date(data.lastSent || Date.now()),
        expiresAt: new Date(data.expires),
      },
      { upsert: true, new: true }
    );
  } catch (_) {}
}

async function removeStoredRegistration(correo) {
  pendingRegistrations.delete(correo);
  try {
    await OtpToken.deleteOne({ correo, tipo: 'registro' });
  } catch (_) {}
}

async function getStoredOtp(correo) {
  try {
    const doc = await OtpToken.findOne({ correo, tipo: 'otp_login' });
    if (doc) {
      return {
        correo: doc.correo,
        code: doc.code,
        intentos: doc.intentos,
        lastSent: doc.lastSent ? new Date(doc.lastSent).getTime() : Date.now(),
        expires: new Date(doc.expiresAt).getTime(),
      };
    }
  } catch (_) {}
  return otpStore.get(correo) || null;
}

async function saveStoredOtp(correo, data) {
  otpStore.set(correo, data);
  try {
    await OtpToken.findOneAndUpdate(
      { correo, tipo: 'otp_login' },
      {
        correo,
        tipo: 'otp_login',
        code: data.code,
        intentos: data.intentos || 0,
        lastSent: new Date(data.lastSent || Date.now()),
        expiresAt: new Date(data.expires),
      },
      { upsert: true, new: true }
    );
  } catch (_) {}
}

async function removeStoredOtp(correo) {
  otpStore.delete(correo);
  try {
    await OtpToken.deleteOne({ correo, tipo: 'otp_login' });
  } catch (_) {}
}

// ─── POST /auth/register ─────────────────────────────────────────────────────

router.post('/register', async (req, res) => {
  try {
    const nombre = (req.body.nombre || req.body.name || '').trim();
    const correo = (req.body.email || req.body.correo || '').trim().toLowerCase();
    const password = req.body.password || req.body.contrasena || '';
    const codigo = (req.body.codigo || req.body.code || '').trim();

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

    // Verificar si el correo ya existe en la base de datos
    const existe = await Perfil.findOne({ correo });
    if (existe) {
      return res.status(409).json({ error: 'Este correo ya está registrado. Debes iniciar sesión o recuperar tu cuenta.' });
    }

    const hash = await bcrypt.hash(password, 12);
    const rol = rolPorCorreo(correo) || 'aprendiz';

    // Si se pasa código de verificación, validar e insertar directamente
    if (codigo) {
      const pending = await getStoredRegistration(correo);
      if (!pending) {
        return res.status(400).json({ error: 'No hay un código pendiente para este correo o ya expiró' });
      }
      if (Date.now() > pending.expires) {
        await removeStoredRegistration(correo);
        return res.status(400).json({ error: 'El código de verificación ha expirado. Por favor solicita uno nuevo.' });
      }

      const MAX_INTENTOS = 5;
      if ((pending.intentos || 0) >= MAX_INTENTOS) {
        await removeStoredRegistration(correo);
        return res.status(429).json({ error: 'Has superado el límite de intentos permitidos. Por seguridad, solicita un nuevo código.' });
      }

      if (String(pending.code).trim() !== codigo) {
        pending.intentos = (pending.intentos || 0) + 1;
        const restantes = MAX_INTENTOS - pending.intentos;
        if (restantes <= 0) {
          await removeStoredRegistration(correo);
          return res.status(429).json({ error: 'Has superado el límite de intentos permitidos. Por seguridad, solicita un nuevo código.' });
        }
        await saveStoredRegistration(correo, pending);
        return res.status(400).json({ error: `Código de verificación incorrecto. Intentos restantes: ${restantes}` });
      }

      await removeStoredRegistration(correo);

      const id = crypto.randomUUID();
      const perfil = await Perfil.create({
        _id: id,
        correo,
        nombre: pending.nombre || nombre,
        rol: pending.rol || rol,
        estado: 'activo',
        password_hash: pending.hash || hash,
        foto_url: pending.foto_url || foto_url,
        primera_publicacion_completada: false,
        creado: new Date(),
        visto: new Date()
      });

      const token = firmarToken(perfil);
      return res.status(201).json({ ok: true, token, user: perfilPublico(perfil) });
    }

    // Cooldown para evitar spam de solicitudes de código
    const pendingExistente = await getStoredRegistration(correo);
    const COOLDOWN_MS = 30 * 1000;
    if (pendingExistente && pendingExistente.lastSent && (Date.now() - pendingExistente.lastSent) < COOLDOWN_MS) {
      const espera = Math.ceil((COOLDOWN_MS - (Date.now() - pendingExistente.lastSent)) / 1000);
      return res.status(429).json({ error: `Por favor espera ${espera} segundos antes de solicitar otro código.` });
    }

    // Flujo estándar: Generar código de 6 dígitos criptográficamente seguro
    const code = generarCodigoSeguro();
    const registrationData = {
      nombre,
      correo,
      hash,
      foto_url,
      rol,
      code,
      intentos: 0,
      lastSent: Date.now(),
      expires: Date.now() + 15 * 60 * 1000 // 15 minutos
    };

    // Guardar el registro pendiente solo cuando el proveedor confirma el envío.
    await enviarCodigoVerificacion(correo, code);

    // Guardar solo si el envío no arrojó excepción
    await saveStoredRegistration(correo, registrationData);

    return res.status(200).json({
      ok: true,
      requiresVerification: true,
      message: `Código de verificación enviado a ${correo}`
    });
  } catch (e) {
    console.error('Error en /auth/register:', e.message);
    if (esErrorCorreo(e)) {
      return res.status(502).json({ error: 'No se pudo enviar el código de verificación al correo. Inténtalo más tarde.' });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ─── POST /auth/verify-registration ──────────────────────────────────────────

router.post('/verify-registration', async (req, res) => {
  try {
    const correo = (req.body.email || req.body.correo || '').trim().toLowerCase();
    const codigo = (req.body.codigo || req.body.code || '').trim();

    if (!correo || !codigo) {
      return res.status(400).json({ error: 'El correo y el código son obligatorios' });
    }

    const pending = await getStoredRegistration(correo);
    if (!pending) {
      return res.status(400).json({ error: 'No hay un registro pendiente para este correo o el código expiró' });
    }

    if (Date.now() > pending.expires) {
      await removeStoredRegistration(correo);
      return res.status(400).json({ error: 'El código de verificación ha expirado. Por favor, regístrate nuevamente.' });
    }

    const MAX_INTENTOS = 5;
    if ((pending.intentos || 0) >= MAX_INTENTOS) {
      await removeStoredRegistration(correo);
      return res.status(429).json({ error: 'Has superado el límite de intentos permitidos. Por seguridad, solicita un nuevo código.' });
    }

    if (String(pending.code).trim() !== codigo) {
      pending.intentos = (pending.intentos || 0) + 1;
      const restantes = MAX_INTENTOS - pending.intentos;
      if (restantes <= 0) {
        await removeStoredRegistration(correo);
        return res.status(429).json({ error: 'Has superado el límite de intentos permitidos. Por seguridad, solicita un nuevo código.' });
      }
      await saveStoredRegistration(correo, pending);
      return res.status(400).json({ error: `Código de verificación incorrecto. Intentos restantes: ${restantes}` });
    }

    // Verificar una vez más que no exista ya en la BD
    const existe = await Perfil.findOne({ correo });
    if (existe) {
      await removeStoredRegistration(correo);
      return res.status(409).json({ error: 'Este correo ya está registrado. Debes iniciar sesión o recuperar tu cuenta.' });
    }

    await removeStoredRegistration(correo);

    const id = crypto.randomUUID();
    const perfil = await Perfil.create({
      _id: id,
      correo: pending.correo,
      nombre: pending.nombre,
      rol: pending.rol || 'aprendiz',
      estado: 'activo',
      password_hash: pending.hash,
      foto_url: pending.foto_url,
      primera_publicacion_completada: false,
      creado: new Date(),
      visto: new Date()
    });

    const token = firmarToken(perfil);
    res.status(201).json({ ok: true, token, user: perfilPublico(perfil) });
  } catch (e) {
    console.error('Error en /auth/verify-registration:', e.message);
    res.status(500).json({ error: 'Error al verificar el registro' });
  }
});

// ─── POST /auth/resend-code ──────────────────────────────────────────────────

router.post('/resend-code', async (req, res) => {
  try {
    const correo = (req.body.email || req.body.correo || '').trim().toLowerCase();
    if (!correo) return res.status(400).json({ error: 'El correo es obligatorio' });

    const pending = await getStoredRegistration(correo);
    if (!pending) {
      return res.status(400).json({ error: 'No hay un registro pendiente para este correo' });
    }

    const COOLDOWN_MS = 30 * 1000;
    if (pending.lastSent && (Date.now() - pending.lastSent) < COOLDOWN_MS) {
      const espera = Math.ceil((COOLDOWN_MS - (Date.now() - pending.lastSent)) / 1000);
      return res.status(429).json({ error: `Por favor espera ${espera} segundos antes de reenviar el código.` });
    }

    const newCode = generarCodigoSeguro();
    pending.code = newCode;
    pending.expires = Date.now() + 15 * 60 * 1000;
    pending.intentos = 0;
    pending.lastSent = Date.now();

    await enviarCodigoVerificacion(correo, newCode);
    await saveStoredRegistration(correo, pending);

    res.json({ ok: true, message: `Nuevo código enviado a ${correo}` });
  } catch (e) {
    console.error('Error en /auth/resend-code:', e.message);
    if (esErrorCorreo(e)) {
      return res.status(502).json({ error: 'No se pudo enviar el código al correo. Inténtalo más tarde.' });
    }
    res.status(500).json({ error: 'Error al reenviar código' });
  }
});

// ─── POST /auth/login ────────────────────────────────────────────────────────

router.post('/login', async (req, res) => {
  try {
    const correo = (req.body.email || req.body.correo || '').trim().toLowerCase();
    const password = req.body.password || req.body.contrasena || '';

    if (!correo || !password) {
      return res.status(400).json({ error: 'Correo y contraseña son obligatorios' });
    }

    // Limitador de intentos por fuerza bruta de contraseñas
    const LOGIN_MAX_INTENTOS = 5;
    const LOGIN_BLOCK_TIME = 15 * 60 * 1000; // 15 minutos
    const intentoInfo = loginAttempts.get(correo);
    if (intentoInfo) {
      if (intentoInfo.bloqueadoHasta && Date.now() < intentoInfo.bloqueadoHasta) {
        const mins = Math.ceil((intentoInfo.bloqueadoHasta - Date.now()) / 60000);
        return res.status(429).json({ error: `Demasiados intentos fallidos. Inténtalo nuevamente en ${mins} minutos.` });
      }
      if (intentoInfo.bloqueadoHasta && Date.now() >= intentoInfo.bloqueadoHasta) {
        loginAttempts.delete(correo);
      }
    }

    const perfil = await Perfil.findOne({ correo }).select('+password_hash');
    if (!perfil || !perfil.password_hash) {
      const actual = loginAttempts.get(correo) || { count: 0 };
      actual.count = (actual.count || 0) + 1;
      if (actual.count >= LOGIN_MAX_INTENTOS) {
        actual.bloqueadoHasta = Date.now() + LOGIN_BLOCK_TIME;
      }
      loginAttempts.set(correo, actual);
      return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
    }

    const coincide = await bcrypt.compare(password, perfil.password_hash);
    if (!coincide) {
      const actual = loginAttempts.get(correo) || { count: 0 };
      actual.count = (actual.count || 0) + 1;
      if (actual.count >= LOGIN_MAX_INTENTOS) {
        actual.bloqueadoHasta = Date.now() + LOGIN_BLOCK_TIME;
      }
      loginAttempts.set(correo, actual);
      return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
    }

    // Login exitoso: reiniciar contador de intentos
    loginAttempts.delete(correo);

    if (perfil.estado === 'suspendido') {
      return res.status(403).json({ error: 'Tu cuenta ha sido suspendida. Contacta a soporte.' });
    }

    const token = firmarToken(perfil);
    res.json({ ok: true, token, user: perfilPublico(perfil) });
  } catch (e) {
    console.error('Error en /auth/login:', e.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ─── Rutas OTP (compatibilidad) ──────────────────────────────────────────────

router.post('/otp', async (req, res) => {
  try {
    const correo = (req.body.email || '').trim().toLowerCase();
    const rol = rolPorDominio(correo);
    if (!rol) {
      return res.status(400).json({ error: 'Solo se admiten correos @misena.edu.co o @sena.edu.co' });
    }

    let perfil = await Perfil.findOne({ correo });
    if (perfil && perfil.estado === 'suspendido') {
      return res.status(403).json({ error: 'Tu cuenta ha sido suspendida. Contacta a soporte.' });
    }

    const stored = await getStoredOtp(correo);
    const COOLDOWN_MS = 30 * 1000;
    if (stored && stored.lastSent && (Date.now() - stored.lastSent) < COOLDOWN_MS) {
      const espera = Math.ceil((COOLDOWN_MS - (Date.now() - stored.lastSent)) / 1000);
      return res.status(429).json({ error: `Por favor espera ${espera} segundos antes de solicitar otro código.` });
    }

    const code = generarCodigoSeguro();
    const otpData = {
      code,
      expires: Date.now() + 10 * 60 * 1000,
      intentos: 0,
      lastSent: Date.now()
    };

    // Enviar código primero
    await enviarCodigoVerificacion(correo, code);
    await saveStoredOtp(correo, otpData);

    if (!perfil) {
      await Perfil.create({ _id: crypto.randomUUID(), correo, nombre: correo.split('@')[0], rol });
    }
    res.json({ ok: true, message: 'Código enviado' });
  } catch (e) {
    if (esErrorCorreo(e)) {
      return res.status(502).json({ error: 'No se pudo enviar el código OTP por correo.' });
    }
    res.status(500).json({ error: e.message });
  }
});

router.post('/verify', async (req, res) => {
  try {
    const correo = (req.body.email || '').trim().toLowerCase();
    const token = (req.body.token || '').trim();
    if (!correo || !token) return res.status(400).json({ error: 'Faltan correo o código' });

    const stored = await getStoredOtp(correo);
    if (!stored) return res.status(400).json({ error: 'No hay código pendiente para ese correo' });
    if (Date.now() > stored.expires) {
      await removeStoredOtp(correo);
      return res.status(400).json({ error: 'El código expiró' });
    }

    const MAX_INTENTOS = 5;
    if ((stored.intentos || 0) >= MAX_INTENTOS) {
      await removeStoredOtp(correo);
      return res.status(429).json({ error: 'Has superado el límite de intentos permitidos. Por seguridad, solicita un nuevo código.' });
    }

    if (String(stored.code).trim() !== token) {
      stored.intentos = (stored.intentos || 0) + 1;
      const restantes = MAX_INTENTOS - stored.intentos;
      if (restantes <= 0) {
        await removeStoredOtp(correo);
        return res.status(429).json({ error: 'Has superado el límite de intentos permitidos. Por seguridad, solicita un nuevo código.' });
      }
      await saveStoredOtp(correo, stored);
      return res.status(400).json({ error: `Código incorrecto. Intentos restantes: ${restantes}` });
    }

    await removeStoredOtp(correo);
    const perfil = await Perfil.findOne({ correo });
    if (!perfil) return res.status(400).json({ error: 'Perfil no encontrado' });

    if (perfil.estado === 'suspendido') {
      return res.status(403).json({ error: 'Tu cuenta ha sido suspendida. Contacta a soporte.' });
    }

    const jwtToken = firmarToken(perfil);
    res.json({ ok: true, token: jwtToken, user: perfilPublico(perfil) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router._pendingRegistrations = pendingRegistrations;
router._otpStore = otpStore;

module.exports = router;
