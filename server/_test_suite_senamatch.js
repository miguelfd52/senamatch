/**
 * Suite completa de pruebas funcionales para SENA Match.
 * Valida los 7 tests requeridos:
 * TEST 1 — MATCH & CHAT ÚNICO
 * TEST 2 — MENSAJES & LECTURA
 * TEST 3 — PARCHES & CHAT GRUPAL
 * TEST 4 — PUBLICACIONES & CLOUDINARY
 * TEST 5 — PERFIL PÚBLICO SEGURO
 * TEST 6 — BLOQUEO BIDIRECCIONAL
 * TEST 7 — NOTIFICACIONES
 */
process.env.JWT_SECRET = 'senamatch-test-secret-key-3.0';
process.env.JWT_EXPIRES_IN = '7d';

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// Modelos y lógica
const Perfil = require('./models/Perfil');
const Chat = require('./models/Chat');
const Match = require('./models/Match');
const Parche = require('./models/Parche');
const Publicacion = require('./models/Publicacion');
const Bloqueo = require('./models/Bloqueo');
const Notificacion = require('./models/Notificacion');
const Swipe = require('./models/Swipe');
const Reporte = require('./models/Reporte');

// Mock in-memory DB para pruebas autónomas rápidas
const dbs = {
  perfiles: new Map(),
  chats: new Map(),
  matches: new Map(),
  parches: new Map(),
  publicaciones: new Map(),
  bloqueos: new Map(),
  notificaciones: new Map(),
  swipes: new Map(),
  reportes: new Map()
};

function setNestedKey(obj, path, val) {
  const parts = path.split('.');
  let curr = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!curr[parts[i]] || typeof curr[parts[i]] !== 'object') curr[parts[i]] = {};
    curr = curr[parts[i]];
  }
  curr[parts[parts.length - 1]] = val;
}

function applyUpdate(doc, update) {
  if (update.$set) {
    for (const [k, v] of Object.entries(update.$set)) {
      if (k.includes('.')) {
        setNestedKey(doc, k, v);
      } else {
        doc[k] = v;
      }
    }
  }
  if (update.$pull) {
    for (const [k, v] of Object.entries(update.$pull)) {
      if (Array.isArray(doc[k])) {
        doc[k] = doc[k].filter(item => String(item) !== String(v));
      }
    }
  }
  if (update.$addToSet) {
    for (const [k, v] of Object.entries(update.$addToSet)) {
      if (!Array.isArray(doc[k])) doc[k] = [];
      if (v.$each) {
        v.$each.forEach(item => { if (!doc[k].includes(item)) doc[k].push(item); });
      } else {
        if (!doc[k].includes(v)) doc[k].push(v);
      }
    }
  }
}

function createMongooseMock(collectionName) {
  const store = dbs[collectionName];
  return {
    findById: (id) => {
      const doc = store.get(String(id));
      const resObj = doc ? {
        ...doc,
        save: async function() { store.set(String(this._id), this); return this; },
        lean: function() { return doc; }
      } : null;
      return {
        select: function() { return this; },
        populate: function() { return this; },
        lean: function() {
          return {
            then: (resolve) => resolve(doc ? JSON.parse(JSON.stringify(doc)) : null)
          };
        },
        then: (resolve) => resolve(resObj)
      };
    },
    findOne: (query) => {
      let found = null;
      for (const doc of store.values()) {
        let match = true;
        if (query.correo && doc.correo !== query.correo) match = false;
        if (query._id && String(doc._id) !== String(query._id)) match = false;
        if (query.recipientId && String(doc.recipientId) !== String(query.recipientId)) match = false;
        if (query.type && doc.type !== query.type) match = false;
        if (query.reference && String(doc.reference) !== String(query.reference)) match = false;
        if (query.$or && Array.isArray(query.$or)) {
          const pass = query.$or.some(cond => {
            return Object.entries(cond).every(([k, v]) => String(doc[k]) === String(v));
          });
          if (!pass) match = false;
        }
        if (query.miembros && query.miembros.$all) {
          const docM = (doc.miembros || []).map(String);
          if (!query.miembros.$all.every(m => docM.includes(String(m)))) match = false;
          if (query.miembros.$size && docM.length !== query.miembros.$size) match = false;
        }
        if (match) { found = doc; break; }
      }
      return {
        select: function() { return this; },
        lean: function() { return found; },
        then: (resolve) => resolve(found ? {
          ...found,
          save: async function() { store.set(String(this._id), this); return this; },
          lean: () => found
        } : null)
      };
    },
    find: (query = {}) => {
      let arr = Array.from(store.values());
      if (query.miembros) {
        arr = arr.filter(d => (d.miembros || []).map(String).includes(String(query.miembros)));
      }
      if (query.recipientId) {
        arr = arr.filter(d => String(d.recipientId) === String(query.recipientId));
      }
      if (query._id && query._id.$ne) {
        arr = arr.filter(d => String(d._id) !== String(query._id.$ne));
      }
      if (query._id && Array.isArray(query._id.$in)) {
        const inList = query._id.$in.map(String);
        arr = arr.filter(d => inList.includes(String(d._id)));
      }
      if (query.$or && Array.isArray(query.$or)) {
        arr = arr.filter(d => {
          return query.$or.some(cond => {
            return Object.entries(cond).every(([k, v]) => String(d[k]) === String(v));
          });
        });
      }
      if (query.activo !== undefined) {
        arr = arr.filter(d => d.activo === query.activo);
      }
      return {
        select: function() { return this; },
        sort: function() { return this; },
        skip: function() { return this; },
        limit: function() { return this; },
        lean: () => arr,
        then: (resolve) => resolve(arr)
      };
    },
    create: async (data) => {
      const id = data._id || 'id_' + Math.random().toString(36).slice(2);
      const doc = { ...data, _id: id };
      store.set(String(id), doc);
      return {
        ...doc,
        save: async function() { store.set(String(this._id), this); return this; }
      };
    },
    findByIdAndUpdate: async (id, update, options = {}) => {
      let doc = store.get(String(id));
      if (!doc && options.upsert) {
        doc = { _id: String(id), ...(update.$setOnInsert || {}) };
      }
      if (!doc) return null;

      applyUpdate(doc, update);
      store.set(String(id), doc);
      return doc;
    },
    findOneAndUpdate: async (query, update, options = {}) => {
      const id = query._id ? String(query._id) : null;
      let doc = id ? store.get(id) : null;
      if (!doc && options.upsert) {
        doc = { _id: id || ('gen_' + Math.random().toString(36).slice(2)), ...(update.$setOnInsert || {}) };
      }
      if (!doc) return null;

      applyUpdate(doc, update);
      store.set(String(doc._id), doc);
      return doc;
    },
    findByIdAndDelete: async (id) => {
      const doc = store.get(String(id));
      store.delete(String(id));
      return doc;
    },
    countDocuments: async (query = {}) => {
      let count = 0;
      for (const doc of store.values()) {
        let match = true;
        if (query.recipientId && String(doc.recipientId) !== String(query.recipientId)) match = false;
        if (query.read !== undefined && doc.read !== query.read) match = false;
        if (query.estado && doc.estado !== query.estado) match = false;
        if (match) count++;
      }
      return count;
    },
    updateMany: async (filter, update) => {
      for (const [id, doc] of store.entries()) {
        let match = true;
        if (filter.recipientId && String(doc.recipientId) !== String(filter.recipientId)) match = false;
        if (filter.read !== undefined && doc.read !== filter.read) match = false;
        if (match && update.$set) {
          Object.assign(doc, update.$set);
          store.set(id, doc);
        }
      }
      return { ok: true };
    }
  };
}

// Sobrescribir modelos para el test suite
Object.assign(Perfil, createMongooseMock('perfiles'));
Object.assign(Chat, createMongooseMock('chats'));
Object.assign(Match, createMongooseMock('matches'));
Object.assign(Parche, createMongooseMock('parches'));
Object.assign(Publicacion, createMongooseMock('publicaciones'));
Object.assign(Bloqueo, createMongooseMock('bloqueos'));
Object.assign(Notificacion, createMongooseMock('notificaciones'));
Object.assign(Swipe, createMongooseMock('swipes'));
Object.assign(Reporte, createMongooseMock('reportes'));

// Cargar Express y rutas
const express = require('express');
const authRoutes = require('./routes/auth');
const perfilesRoutes = require('./routes/perfiles');
const chatsRoutes = require('./routes/chats');
const swipesRoutes = require('./routes/swipes');
const parchesRoutes = require('./routes/parches');
const publicacionesRoutes = require('./routes/publicaciones');
const notificacionesRoutes = require('./routes/notificaciones');
const adminRoutes = require('./routes/admin');
const miscRoutes = require('./routes/misc');

const app = express();
app.use(express.json());
app.use('/auth', authRoutes);
app.use('/perfiles', perfilesRoutes);
app.use('/chats', chatsRoutes);
app.use('/swipes', swipesRoutes);
app.use('/parches', parchesRoutes);
app.use('/publicaciones', publicacionesRoutes);
app.use('/notificaciones', notificacionesRoutes.router);
app.use('/admin', adminRoutes);
app.use('/', miscRoutes);

async function runTests() {
  const PORT = 5544;
  const server = app.listen(PORT);
  const BASE = `http://127.0.0.1:${PORT}`;

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (!condition) {
      console.error(`❌ FAIL: ${message}`);
      throw new Error(message);
    }
    passed++;
    console.log(`✅ PASS: ${message}`);
  }

  try {
    console.log('\n--- INICIANDO SUITE DE PRUEBAS DE SENA MATCH ---\n');

    // Preparar usuarios: User A, User B, User C, Admin
    const passHash = await bcrypt.hash('password123', 8);

    await Perfil.create({
      _id: 'user_a',
      nombre: 'Aprendiz A',
      correo: 'aprendiz.a@misena.edu.co',
      password_hash: passHash,
      rol: 'aprendiz',
      estado: 'activo',
      centro: 11303,
      programa: 'ADSO',
      ficha: '2654321',
      intereses: ['Programación', 'Fútbol', 'Música'],
      intenciones: ['amistad', 'estudio']
    });

    await Perfil.create({
      _id: 'user_b',
      nombre: 'Aprendiz B',
      correo: 'aprendiz.b@misena.edu.co',
      password_hash: passHash,
      rol: 'aprendiz',
      estado: 'activo',
      centro: 11303,
      programa: 'ADSO',
      ficha: '2654322',
      intereses: ['Programación', 'Gaming'],
      intenciones: ['amistad', 'estudio']
    });

    await Perfil.create({
      _id: 'user_c',
      nombre: 'Aprendiz C (Tercero)',
      correo: 'aprendiz.c@misena.edu.co',
      password_hash: passHash,
      rol: 'aprendiz',
      estado: 'activo',
      centro: 11303,
      programa: 'Multimedia',
      ficha: '2654323',
      intereses: ['Cine'],
      intenciones: ['amistad']
    });

    await Perfil.create({
      _id: 'user_admin',
      nombre: 'Moderador SENA',
      correo: 'admin@sena.edu.co',
      password_hash: passHash,
      rol: 'moderador',
      estado: 'activo',
      centro: 11303
    });

    const tokenA = jwt.sign({ uid: 'user_a', correo: 'aprendiz.a@misena.edu.co', rol: 'aprendiz' }, process.env.JWT_SECRET);
    const tokenB = jwt.sign({ uid: 'user_b', correo: 'aprendiz.b@misena.edu.co', rol: 'aprendiz' }, process.env.JWT_SECRET);
    const tokenC = jwt.sign({ uid: 'user_c', correo: 'aprendiz.c@misena.edu.co', rol: 'aprendiz' }, process.env.JWT_SECRET);
    const tokenAdmin = jwt.sign({ uid: 'user_admin', correo: 'admin@sena.edu.co', rol: 'moderador' }, process.env.JWT_SECRET);

    // ========================================================
    // TEST 1 — MATCH & CHAT ÚNICO
    // ========================================================
    console.log('\n[TEST 1 — MATCH & CHAT ÚNICO]');
    // A da like a B
    let r = await fetch(`${BASE}/swipes/registrar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ p_otro: 'user_b', p_intencion: 'amistad', p_dir: 'like' })
    });
    let data = await r.json();
    if (!r.ok || data.match !== false) console.log('DEBUG SWIPE 1:', r.status, data);
    assert(data.match === false, 'A da like a B (sin match todavía)');

    // B da like a A -> ¡MATCH!
    r = await fetch(`${BASE}/swipes/registrar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({ p_otro: 'user_a', p_intencion: 'amistad', p_dir: 'like' })
    });
    data = await r.json();
    assert(data.match === true && data.chat, 'B da like a A -> Match recíproco y chat creado');

    const chatId = data.chat;

    // A puede ver el chat
    r = await fetch(`${BASE}/chats/${chatId}`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert(r.status === 200, 'Usuario A tiene acceso al chat de match');

    // B puede ver el chat
    r = await fetch(`${BASE}/chats/${chatId}`, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    assert(r.status === 200, 'Usuario B tiene acceso al chat de match');

    // C NO puede ver el chat
    r = await fetch(`${BASE}/chats/${chatId}`, {
      headers: { Authorization: `Bearer ${tokenC}` }
    });
    assert(r.status === 403, 'Usuario C ajeno recibe 403 Forbidden al intentar ver el chat');

    // ========================================================
    // TEST 2 — MENSAJES & LECTURA
    // ========================================================
    console.log('\n[TEST 2 — MENSAJES & PERSISTENCIA]');
    // A envía mensaje
    r = await fetch(`${BASE}/chats/${chatId}/mensaje`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ txt: 'Hola B, ¡un gusto conectar en SENA Match!' })
    });
    assert(r.status === 201, 'A envía mensaje correctamente al chat');

    // B consulta el chat y verifica persistencia
    r = await fetch(`${BASE}/chats/${chatId}`, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    const chatDoc = await r.json();
    const ultimoMensaje = chatDoc.mensajes[chatDoc.mensajes.length - 1];
    assert(ultimoMensaje && ultimoMensaje.txt === 'Hola B, ¡un gusto conectar en SENA Match!', 'B recibe y visualiza el mensaje guardado');

    // B marca mensajes como leídos
    r = await fetch(`${BASE}/chats/${chatId}/leer`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    assert(r.status === 200, 'B marca la conversación como leída');

    // B envía mensaje vacío (debe fallar con mensaje en español)
    r = await fetch(`${BASE}/chats/${chatId}/mensaje`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({ txt: '   ' })
    });
    assert(r.status === 400, 'Mensaje vacío rechazado correctamente por backend');

    // ========================================================
    // TEST 3 — PARCHES & CHAT GRUPAL
    // ========================================================
    console.log('\n[TEST 3 — PARCHES & SINCRONIZACIÓN]');
    // A crea un parche
    r = await fetch(`${BASE}/parches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        titulo: 'Parche de Estudio ADSO',
        tipo: 'estudio',
        lugar: 'Biblioteca Central Bloque 2',
        cupo: 5,
        descripcion: 'Estudiaremos algoritmos'
      })
    });
    const parcheCreado = await r.json();
    assert(parcheCreado.id && parcheCreado.estado === 'abierto', 'A crea parche grupal exitosamente');

    const parcheId = parcheCreado.id;

    // B se une al parche
    r = await fetch(`${BASE}/parches/${parcheId}/entrar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    assert(r.status === 200, 'Usuario B se une al parche');

    // B accede al chat del parche
    r = await fetch(`${BASE}/chats/${parcheId}`, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    assert(r.status === 200, 'Usuario B tiene acceso al chat grupal del parche');

    // C (no unido) intenta acceder al chat del parche
    r = await fetch(`${BASE}/chats/${parcheId}`, {
      headers: { Authorization: `Bearer ${tokenC}` }
    });
    assert(r.status === 403, 'Usuario C ajeno es bloqueado de acceder al chat del parche');

    // B sale del parche
    r = await fetch(`${BASE}/parches/${parcheId}/salir`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    assert(r.status === 200, 'Usuario B sale del parche');

    // B ya no debe poder acceder al chat del parche
    r = await fetch(`${BASE}/chats/${parcheId}`, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    assert(r.status === 403, 'Usuario B pierde el acceso al chat tras salir');

    // ========================================================
    // TEST 4 — PUBLICACIONES & CLOUDINARY
    // ========================================================
    console.log('\n[TEST 4 — PUBLICACIONES & CLOUDINARY]');
    // Rechazo de imágenes base64
    r = await fetch(`${BASE}/publicaciones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ texto: 'Post con base64', fotoUrl: 'data:image/png;base64,iVBORw0KGgo...' })
    });
    assert(r.status === 400, 'Rechazo estricto de imágenes base64 en MongoDB');

    // Crear publicación con URL válida de Cloudinary
    r = await fetch(`${BASE}/publicaciones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        texto: 'Comparto fotos del proyecto integrador en SENA Match',
        fotoUrl: 'https://res.cloudinary.com/jsts4pi6/image/upload/v1/senamatch/sample.jpg'
      })
    });
    const postCreado = await r.json();
    assert(postCreado.id && postCreado.fotoUrl.startsWith('https://'), 'Publicación creada con URL HTTPS de Cloudinary');

    const postId = postCreado.id;

    // B intenta editar el post de A -> Rechazado
    r = await fetch(`${BASE}/publicaciones/${postId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({ texto: 'Hackeando post' })
    });
    assert(r.status === 403, 'Usuario B no puede editar publicación de A (403)');

    // A edita su propio post
    r = await fetch(`${BASE}/publicaciones/${postId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ texto: 'Texto editado por el autor legítimo' })
    });
    assert(r.status === 200, 'Autor A edita su propia publicación exitosamente');

    // B da like
    r = await fetch(`${BASE}/publicaciones/${postId}/like`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    const likeRes = await r.json();
    assert(likeRes.likesCount === 1 && likeRes.likedPorMi === true, 'B da like y contador se incrementa');

    // B comenta
    r = await fetch(`${BASE}/publicaciones/${postId}/comentarios`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({ texto: '¡Excelente proyecto!' })
    });
    assert(r.status === 201, 'B comenta en la publicación');

    // A elimina su publicación
    r = await fetch(`${BASE}/publicaciones/${postId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert(r.status === 200, 'Propietario A elimina su publicación');

    // ========================================================
    // TEST 5 — PERFIL PÚBLICO SEGURO
    // ========================================================
    console.log('\n[TEST 5 — PERFIL PÚBLICO SEGURO]');
    r = await fetch(`${BASE}/perfiles/user_a/publico`, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    const publicProfile = await r.json();
    assert(publicProfile.nombre === 'Aprendiz A', 'Perfil público devuelve nombre');
    assert(publicProfile.programa === 'ADSO', 'Perfil público devuelve programa');
    assert(publicProfile.correo === undefined, 'Perfil público NO expone correo privado');
    assert(publicProfile.ficha === undefined, 'Perfil público NO expone número de ficha');
    assert(publicProfile.password_hash === undefined, 'Perfil público NO expone contraseñas ni hashes');

    // ========================================================
    // TEST 6 — BLOQUEO BIDIRECCIONAL
    // ========================================================
    console.log('\n[TEST 6 — BLOQUEO BIDIRECCIONAL]');
    // A bloquea a C
    r = await fetch(`${BASE}/bloqueos/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ targetUserId: 'user_c' })
    });
    assert(r.status === 200, 'Usuario A bloquea a Usuario C');

    // C intenta enviar like a A -> Rechazado
    r = await fetch(`${BASE}/swipes/registrar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenC}` },
      body: JSON.stringify({ p_otro: 'user_a', p_intencion: 'amistad', p_dir: 'like' })
    });
    assert(r.status === 403, 'Usuario bloqueado no puede dar like ni hacer match (403)');

    // C intenta ver perfil público de A -> Rechazado por bloqueo
    r = await fetch(`${BASE}/perfiles/user_a/publico`, {
      headers: { Authorization: `Bearer ${tokenC}` }
    });
    assert(r.status === 403, 'Usuario bloqueado no puede acceder al perfil público (403)');

    // ========================================================
    // TEST 7 — NOTIFICACIONES
    // ========================================================
    console.log('\n[TEST 7 — NOTIFICACIONES]');
    // Consultar notificaciones de B (debe tener las generadas por el match y mensaje)
    r = await fetch(`${BASE}/notificaciones`, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    const notifsB = await r.json();
    assert(Array.isArray(notifsB.notificaciones) && notifsB.notificaciones.length > 0, 'B tiene notificaciones generadas');
    assert(notifsB.unreadCount > 0, 'Contador de notificaciones no leídas es correcto');

    // Marcar una notificación como leída
    const notifId = notifsB.notificaciones[0].id;
    r = await fetch(`${BASE}/notificaciones/${notifId}/leer`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    assert(r.status === 200, 'Notificación individual marcada como leída');

    // Marcar todas como leídas
    r = await fetch(`${BASE}/notificaciones/leer-todas`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    const leerTodasRes = await r.json();
    assert(leerTodasRes.unreadCount === 0, 'Todas las notificaciones marcadas como leídas (unreadCount: 0)');

    // ========================================================
    // TEST 8 — REGISTRO, FOTO OBLIGATORIA & PRIMERA PUBLICACIÓN
    // ========================================================
    console.log('\n[TEST 8 — REGISTRO & PUBLICACIÓN OBLIGATORIA]');
    // 1. Registro nuevo sin foto -> Rechazado
    r = await fetch(`${BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: 'Nuevo Aprendiz',
        email: 'nuevo.aprendiz@misena.edu.co',
        password: 'password123'
      })
    });
    assert(r.status === 400, 'Registro nuevo sin foto de perfil rechazado (400)');

    // 2. Registro con foto -> Permitido
    r = await fetch(`${BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: 'Nuevo Aprendiz',
        email: 'nuevo.aprendiz@misena.edu.co',
        password: 'password123',
        foto_url: 'https://res.cloudinary.com/jsts4pi6/image/upload/v1/senamatch/avatar1.jpg'
      })
    });
    const regData = await r.json();
    assert(r.status === 201 && regData.token, 'Registro con foto de perfil permitido (201)');
    const tokenNuevo = regData.token;
    const uidNuevo = regData.user.id;

    // Usuario nuevo tiene primeraPublicacionCompletada === false
    assert(regData.user.primeraPublicacionCompletada === false, 'Nuevo usuario tiene primera publicación pendiente');

    // 3. Primera publicación sin texto o sin foto -> Rechazada
    r = await fetch(`${BASE}/publicaciones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenNuevo}` },
      body: JSON.stringify({ texto: '' })
    });
    assert(r.status === 400, 'Primera publicación vacía rechazada');

    // 4. Primera publicación completa con foto y texto -> Permitida
    r = await fetch(`${BASE}/publicaciones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenNuevo}` },
      body: JSON.stringify({
        texto: '¡Hola a todos! Mi primera publicación en SENA Match',
        fotoUrl: 'https://res.cloudinary.com/jsts4pi6/image/upload/v1/senamatch/firstpost.jpg'
      })
    });
    assert(r.status === 201, 'Primera publicación completa permitida');

    // 5. Verificar que primera_publicacion_completada se guardó en MongoDB
    const perfilActualizado = await Perfil.findById(uidNuevo);
    assert(perfilActualizado.primera_publicacion_completada === true, 'Estado de primera publicación guardado en MongoDB como completado');

    // ========================================================
    // TEST 9 — "NO ME INTERESA" (PASS) PERMANENTE & MATCH MUTUO ÚNICO
    // ========================================================
    console.log('\n[TEST 9 — NO ME INTERESA & MATCH MUTUO ÚNICO]');
    // Desbloquear a C previamente bloqueado en TEST 6 para probar swipe pass limpiamente
    await fetch(`${BASE}/bloqueos/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ targetUserId: 'user_c' })
    });

    // Usuario A da "pass" (No me interesa) a Usuario C
    r = await fetch(`${BASE}/swipes/registrar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ p_otro: 'user_c', p_intencion: 'amistad', p_dir: 'pass' })
    });
    const passData = await r.json();
    assert(passData.match === false, 'Decisión "No me interesa" guardada sin crear match');

    // C no debe aparecer en los perfiles de A (GET /perfiles)
    r = await fetch(`${BASE}/perfiles`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const perfilesParaA = await r.json();
    const cEncontrado = perfilesParaA.some(p => p.id === 'user_c');
    assert(!cEncontrado, 'Usuario descartado ("No me interesa") no aparece en Descubrir de A');

    // C tampoco debe poder recibir ni enviar chats directos a A
    r = await fetch(`${BASE}/chats/directo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ targetUserId: 'user_c' })
    });
    assert(r.status === 403, 'Usuario descartado no puede iniciar chat directo');

    // Usuario B y A ya tienen match mutuo: ninguno debe aparecer en Descubrir del otro
    const bEncontrado = perfilesParaA.some(p => p.id === 'user_b');
    assert(!bEncontrado, 'Usuario con match mutuo eliminado de Descubrir');

    // ========================================================
    // TEST 10 — GRUPOS MUESTRAN NOMBRES REALES DE REMITENTES
    // ========================================================
    console.log('\n[TEST 10 — GRUPOS MUESTRAN NOMBRES REALES]');
    // A consulta el chat del parche
    r = await fetch(`${BASE}/chats/${parcheId}`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const chatParche = await r.json();
    const msgsParche = chatParche.mensajes || [];
    const todosTienenNombre = msgsParche.every(m => m.senderNombre && !m.senderNombre.startsWith('id_'));
    assert(todosTienenNombre, 'Mensajes grupales muestran el nombre real del remitente y no su ID');

    console.log(`\n🎉 TODAS LAS PRUEBAS COMPLETADAS EXITOSAMENTE: ${passed}/${total} PASARON SIN ERRORES\n`);
    server.close();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ ERROR EN LA SUITE DE PRUEBAS:', err);
    server.close();
    process.exit(1);
  }
}

runTests();
