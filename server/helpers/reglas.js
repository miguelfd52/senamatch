const Bloqueo = require('../models/Bloqueo');
const Config = require('../models/Config');

/** El rol lo decide el dominio del correo. */
function rolPorDominio(correo) {
  const e = correo.trim().toLowerCase();
  if (e.endsWith('@misena.edu.co')) return 'aprendiz';
  if (e.endsWith('@sena.edu.co')) return 'instructor';
  return null;
}

/** Esfera derivada del rol. */
function esferaDe(rol) {
  return (rol === 'aprendiz' || rol === 'egresado') ? 'aprendices' : 'equipo';
}

/** Edad a partir de fecha de nacimiento. */
function edad(nacimiento) {
  if (!nacimiento) return null;
  const n = new Date(nacimiento);
  const hoy = new Date();
  let a = hoy.getFullYear() - n.getFullYear();
  const m = hoy.getMonth() - n.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < n.getDate())) a--;
  return a;
}

/** ¿Es staff (bienestar, moderador, admin)? */
function esStaff(perfil) {
  return perfil && ['bienestar', 'moderador', 'admin'].includes(perfil.rol);
}

/** Bloqueo simétrico: basta que exista en un sentido. */
async function hayBloqueo(a, b) {
  const ba = await Bloqueo.findById(a);
  if (ba && ba.ids.includes(b)) return true;
  const bb = await Bloqueo.findById(b);
  if (bb && bb.ids.includes(a)) return true;
  return false;
}

/** ¿El modo cita está activo? */
async function modoCitaActivo() {
  const c = await Config.findById('centro');
  return !!(c && c.datos && c.datos.modoCita);
}

/**
 * Las seis compuertas del descubrimiento 1 a 1.
 * Réplica de la función puedo_ver() del esquema SQL.
 */
async function puedoVer(yo, otro, intencion) {
  if (!yo || !otro || yo._id === otro._id) return false;
  if (yo.estado !== 'activo' || otro.estado !== 'activo') return false;

  const miEsfera = esferaDe(yo.rol);
  const otraEsfera = esferaDe(otro.rol);
  if (miEsfera !== otraEsfera) return false;

  if (yo.centro && otro.centro && yo.centro !== otro.centro) return false;
  const intencionesYo = (yo.intenciones && yo.intenciones.length > 0) ? yo.intenciones : ['amistad', 'estudio'];
  const intencionesOtro = (otro.intenciones && otro.intenciones.length > 0) ? otro.intenciones : ['amistad', 'estudio'];
  if (!intencionesYo.includes(intencion)) return false;
  if (!intencionesOtro.includes(intencion)) return false;
  if (await hayBloqueo(yo._id, otro._id)) return false;

  if (intencion === 'cita') {
    if (!(await modoCitaActivo())) return false;
    if ((edad(yo.nacimiento) || 0) < 18) return false;
    if ((edad(otro.nacimiento) || 0) < 18) return false;
  }

  if (intencion === 'colegas') {
    if (miEsfera !== 'equipo' || otraEsfera !== 'equipo') return false;
  }

  return true;
}

/**
 * ¿El usuario puede ver este parche?
 * Ahora cualquier usuario registrado puede ver todos los parches de la comunidad.
 */
async function puedoVerParche(perfil, parche) {
  if (!perfil || !parche) return false;

  // Ya es participante → sí
  if ((parche.participantes || []).some(p => p.id === perfil._id)) return true;

  if (perfil.estado === 'suspendido') return false;
  try {
    if (await hayBloqueo(perfil._id, parche.anfitrion)) return false;
  } catch (e) {
    // Si falla la comprobación de bloqueo, permitir acceso
  }

  return true;
}

module.exports = {
  rolPorDominio, esferaDe, edad, esStaff,
  hayBloqueo, modoCitaActivo, puedoVer, puedoVerParche
};
