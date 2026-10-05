process.env.JWT_SECRET = 'test-secret-123';
process.env.JWT_EXPIRES_IN = '7d';

const jwt = require('jsonwebtoken');
const express = require('express');
const Publicacion = require('./models/Publicacion');
const Perfil = require('./models/Perfil');
const Bloqueo = require('./models/Bloqueo');
Bloqueo.findById = async () => null;

const pubDb = new Map();
const perfilDb = new Map();

// Mock Perfil
Perfil.findById = (id) => {
  const p = perfilDb.get(id) || {
    _id: id,
    nombre: 'Aprendiz Prueba',
    rol: 'aprendiz',
    avatar_emoji: '🎓',
    avatar_color: '#FF6B4A',
    foto_url: null,
  };
  return {
    lean: () => Promise.resolve(p),
    then: (res, rej) => Promise.resolve(p).then(res, rej),
  };
};

// Mock Publicacion
Publicacion.find = () => {
  const items = Array.from(pubDb.values()).sort((a, b) => b.creado - a.creado);
  return {
    sort: () => ({
      skip: () => ({
        limit: () => ({
          lean: () => Promise.resolve(items),
        }),
      }),
      limit: () => ({
        lean: () => Promise.resolve(items),
      }),
    }),
  };
};

Publicacion.countDocuments = async () => pubDb.size;

Publicacion.create = async (data) => {
  const doc = {
    ...data,
    save: async function () {
      pubDb.set(this._id, this);
      return this;
    }
  };
  pubDb.set(data._id, doc);
  return doc;
};

Publicacion.findById = async (id) => {
  const doc = pubDb.get(id);
  if (!doc) return null;
  return {
    ...doc,
    save: async function () {
      pubDb.set(id, this);
      return this;
    }
  };
};

const token = jwt.sign({ uid: 'user_123', sub: 'user_123' }, process.env.JWT_SECRET);

const publicacionesRoutes = require('./routes/publicaciones');
const app = express();
app.use(express.json());
app.use('/publicaciones', publicacionesRoutes);

const server = app.listen(4322, async () => {
  try {
    console.log('Iniciando tests de publicaciones...');

    // 1. GET inicial (vacío)
    let res = await fetch('http://localhost:4322/publicaciones', {
      headers: { Authorization: `Bearer ${token}` },
    });
    let data = await res.json();
    console.log('1. GET vacío: status', res.status, 'longitud:', data.length);
    if (res.status !== 200 || !Array.isArray(data)) throw new Error('GET inicial falló');

    // 2. POST crear publicación
    res = await fetch('http://localhost:4322/publicaciones', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        texto: '¡Hola comunidad SENA! Este es mi primer parche de estudio 📚',
        fotoUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3',
      }),
    });
    data = await res.json();
    console.log('2. POST crear:', res.status, 'id:', data.id, 'texto:', data.texto);
    if (res.status !== 201 || !data.id) throw new Error('POST crear falló');
    const pubId = data.id;

    // 3. POST like (toggle ON)
    res = await fetch(`http://localhost:4322/publicaciones/${pubId}/like`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    data = await res.json();
    console.log('3. POST like ON:', res.status, 'likes:', data.likesCount, 'likedPorMi:', data.likedPorMi);
    if (data.likesCount !== 1 || !data.likedPorMi) throw new Error('POST like ON falló');

    // 4. POST like (toggle OFF)
    res = await fetch(`http://localhost:4322/publicaciones/${pubId}/like`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    data = await res.json();
    console.log('4. POST like OFF:', res.status, 'likes:', data.likesCount, 'likedPorMi:', data.likedPorMi);
    if (data.likesCount !== 0 || data.likedPorMi) throw new Error('POST like OFF falló');

    // 5. POST comentario
    res = await fetch(`http://localhost:4322/publicaciones/${pubId}/comentarios`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ texto: '¡Excelente iniciativa! Cuenta conmigo.' }),
    });
    data = await res.json();
    console.log('5. POST comentario:', res.status, 'comentario:', data.texto, 'total:', data.totalComentarios);
    if (res.status !== 201 || data.totalComentarios !== 1) throw new Error('POST comentario falló');

    // 6. GET con datos
    res = await fetch('http://localhost:4322/publicaciones', {
      headers: { Authorization: `Bearer ${token}` },
    });
    data = await res.json();
    console.log('6. GET con datos: status', res.status, 'longitud:', data.length, 'comentarios:', data[0].comentarios.length);
    if (data.length !== 1 || data[0].comentarios.length !== 1) throw new Error('GET con datos falló');

    console.log('✅ TODOS LOS TESTS DE PUBLICACIONES PASARON CORRECTAMENTE');
  } catch (e) {
    console.error('❌ ERROR EN TEST:', e);
    process.exitCode = 1;
  } finally {
    server.close();
  }
});
