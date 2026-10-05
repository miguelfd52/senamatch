/**
 * Reglas de dominio de SENA Match.
 *
 * ATENCIÓN: este archivo NO es la fuente de verdad. Las mismas reglas están
 * escritas en Postgres (`puedo_ver_perfil`, `puedo_ver_parche`, RLS de 0007) y
 * son las que efectivamente protegen los datos. Lo de aquí sirve para no pintar
 * botones que el servidor va a rechazar, y para que el equipo lea las reglas sin
 * abrir el SQL. Si las dos versiones divergen, la que manda es la base.
 */

export type Rol =
  | 'aprendiz'
  | 'egresado'
  | 'instructor'
  | 'bienestar'
  | 'moderador'
  | 'admin';

export type Esfera = 'aprendices' | 'equipo';
export type Verificacion = 'correo' | 'ficha' | 'institucional';
export type Intencion = 'cita' | 'amistad' | 'estudio' | 'deporte' | 'colegas';

export type TipoParche =
  | 'desayuno' | 'almuerzo' | 'cafe' | 'estudio'
  | 'deporte' | 'integracion' | 'cultural' | 'tramite' | 'otro';

export interface Perfil {
  id: string;
  rol: Rol;
  esfera: Esfera;
  verificacion: Verificacion;
  estado: 'activo' | 'pausado' | 'suspendido' | 'eliminado';
  centerId: number | null;
  fechaNacimiento: string | null; // ISO
  intenciones: Intencion[];
  onboardingCompleto: boolean;
}

export interface ConfigCentro {
  modoCitaAprendices: boolean;
  modoCitaEquipo: boolean;
  parchesMixtos: boolean;
  radioMaxMetros: number;
  cupoMaxParche: number;
}

/** El dominio del correo decide el rol. El formulario no opina. */
export function rolPorDominio(email: string): Rol | null {
  const e = email.trim().toLowerCase();
  if (e.endsWith('@misena.edu.co')) return 'aprendiz';
  if (e.endsWith('@sena.edu.co')) return 'instructor';
  return null;
}

export function esferaDe(rol: Rol): Esfera {
  return rol === 'aprendiz' || rol === 'egresado' ? 'aprendices' : 'equipo';
}

export function edad(fechaNacimientoISO: string | null, hoy = new Date()): number | null {
  if (!fechaNacimientoISO) return null;
  const n = new Date(fechaNacimientoISO);
  let a = hoy.getFullYear() - n.getFullYear();
  const m = hoy.getMonth() - n.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < n.getDate())) a--;
  return a;
}

export const esMayorDeEdad = (p: Perfil, hoy = new Date()): boolean =>
  (edad(p.fechaNacimiento, hoy) ?? 0) >= 18;

/** Las intenciones que esta persona puede activar hoy, en este centro. */
export function intencionesDisponibles(p: Perfil, cfg: ConfigCentro): Intencion[] {
  if (p.esfera === 'equipo') {
    if (p.verificacion !== 'institucional') return [];
    return cfg.modoCitaEquipo ? ['colegas', 'cita'] : ['colegas'];
  }
  const base: Intencion[] = ['amistad', 'estudio', 'deporte'];
  if (cfg.modoCitaAprendices && esMayorDeEdad(p)) base.unshift('cita');
  return base;
}

/**
 * Espejo de `puedo_ver_perfil()`. Devuelve el motivo cuando dice que no, para
 * que la interfaz explique en vez de mostrar una lista vacía sin razón.
 */
export type MotivoOculto =
  | 'cuenta_inactiva'
  | 'onboarding_incompleto'
  | 'otra_esfera'
  | 'otro_centro'
  | 'intencion_no_compartida'
  | 'bloqueado'
  | 'modo_cita_apagado'
  | 'menor_de_edad'
  | 'sin_aval_institucional';

export function puedeVerPerfil(
  yo: Perfil,
  otro: Perfil,
  intencion: Intencion,
  cfg: ConfigCentro,
  bloqueado = false,
): { visible: true } | { visible: false; motivo: MotivoOculto } {
  if (yo.estado !== 'activo' || otro.estado !== 'activo') return { visible: false, motivo: 'cuenta_inactiva' };
  if (!otro.onboardingCompleto) return { visible: false, motivo: 'onboarding_incompleto' };
  if (yo.esfera !== otro.esfera) return { visible: false, motivo: 'otra_esfera' };
  if (yo.centerId !== otro.centerId) return { visible: false, motivo: 'otro_centro' };
  if (!yo.intenciones.includes(intencion) || !otro.intenciones.includes(intencion))
    return { visible: false, motivo: 'intencion_no_compartida' };
  if (bloqueado) return { visible: false, motivo: 'bloqueado' };

  if (intencion === 'cita') {
    const encendido = yo.esfera === 'aprendices' ? cfg.modoCitaAprendices : cfg.modoCitaEquipo;
    if (!encendido) return { visible: false, motivo: 'modo_cita_apagado' };
    if (!esMayorDeEdad(yo) || !esMayorDeEdad(otro)) return { visible: false, motivo: 'menor_de_edad' };
  }

  if (intencion === 'colegas') {
    if (yo.esfera !== 'equipo' || otro.esfera !== 'equipo')
      return { visible: false, motivo: 'otra_esfera' };
    if (yo.verificacion !== 'institucional' || otro.verificacion !== 'institucional')
      return { visible: false, motivo: 'sin_aval_institucional' };
  }

  return { visible: true };
}

/** Coordenadas redondeadas a ~100 m antes de salir del dispositivo. */
export const difuminarUbicacion = (lat: number, lng: number) => ({
  lat: Math.round(lat * 1000) / 1000,
  lng: Math.round(lng * 1000) / 1000,
});

/** Estado de un parche a ojos de quien lo mira, para el texto del botón. */
export function estadoDeParche(p: {
  status: string;
  startsAt: string;
  capacity: number;
  confirmados: number;
  yaEstoy: boolean;
  aprobacion: boolean;
}): { etiqueta: string; puedeUnirse: boolean } {
  if (p.yaEstoy) return { etiqueta: 'Ya estás dentro', puedeUnirse: false };
  if (p.status === 'cancelado') return { etiqueta: 'Cancelado', puedeUnirse: false };
  if (new Date(p.startsAt) <= new Date()) return { etiqueta: 'Ya empezó', puedeUnirse: false };
  if (p.confirmados >= p.capacity)
    return p.aprobacion
      ? { etiqueta: 'Lista de espera', puedeUnirse: true }
      : { etiqueta: 'Sin cupos', puedeUnirse: false };
  const libres = p.capacity - p.confirmados;
  return {
    etiqueta: p.aprobacion ? `Pedir cupo · quedan ${libres}` : `Unirme · quedan ${libres}`,
    puedeUnirse: true,
  };
}
