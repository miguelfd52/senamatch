process.env.JWT_SECRET = 'test-secret';
process.env.JWT_EXPIRES_IN = '7d';

const express = require('express');
const Perfil = require('./models/Perfil');

// Mock de Perfil sin DB real, imitando el query builder de mongoose (findOne().select())
const db = new Map();
function makeQuery(doc) {
  return {
    select: function() { return this; },
    then: (resolve, reject) => Promise.resolve(doc).then(resolve, reject),
    catch: (fn) => Promise.resolve(doc).catch(fn),
  };
}
Perfil.findOne = (query) => {
  const correo = query.correo;
  const doc = db.get(correo) || null;
  return makeQuery(doc);
};
Perfil.create = async (data) => {
  db.set(data.correo, data);
  return data;
};

const authRoutes = require('./routes/auth');
const app = express();
app.use(express.json());
app.use('/auth', authRoutes);
const server = app.listen(4321, async () => {
  try {
    let r = await fetch('http://localhost:4321/auth/register', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ nombre: 'Juan Perez', email: 'juan@gmail.com', password: 'password123' })
    });
    console.log('REGISTER status:', r.status, JSON.stringify(await r.json()));

    r = await fetch('http://localhost:4321/auth/login', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ email: 'juan@gmail.com', password: 'password123' })
    });
    console.log('LOGIN status:', r.status, JSON.stringify(await r.json()));

    // Login con clave incorrecta
    r = await fetch('http://localhost:4321/auth/login', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ email: 'juan@gmail.com', password: 'incorrecta' })
    });
    console.log('LOGIN MAL status:', r.status, JSON.stringify(await r.json()));

    // Registro duplicado
    r = await fetch('http://localhost:4321/auth/register', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ nombre: 'Juan Perez', email: 'juan@gmail.com', password: 'password123' })
    });
    console.log('REGISTER DUP status:', r.status, JSON.stringify(await r.json()));
  } catch(e) {
    console.error('TEST ERROR:', e);
  } finally {
    server.close();
  }
});
