import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// En Expo Web el navegador y el backend viven en el mismo equipo: usar
// localhost evita que Windows bloquee la conexión hacia su propia IP Wi-Fi.
// En Expo Go se conserva la IP de la red definida en .env.
// Obtener la URL de la API según el entorno
export const getApiUrl = () => {
  const envUrl = process.env.EXPO_PUBLIC_API_URL ? process.env.EXPO_PUBLIC_API_URL.trim() : '';

  // 1. En entorno Web:
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
    const host = window.location.hostname;
    const isLocalhost = host === 'localhost' || host === '127.0.0.1';
    const isLanIp = /^192\.168\.|^10\.|^172\.(1[6-9]|2[0-9]|3[01])\./.test(host) || host.endsWith('.local');

    // En desarrollo local en navegador vía localhost:
    if (isLocalhost) {
      if (envUrl && (envUrl.includes('localhost') || envUrl.includes('127.0.0.1'))) {
        return envUrl.replace(/\/$/, '');
      }
      return 'http://localhost:3001';
    }

    // En desarrollo local abierto con la IP de la red local (ej. http://192.168.x.x:8081):
    if (isLanIp) {
      return `http://${host}:3001`;
    }

    // En producción Web (ej. https://senamatch-k9dt.vercel.app):
    if (envUrl && !envUrl.includes('192.168.') && !envUrl.includes('10.') && !envUrl.includes('localhost')) {
      return envUrl.replace(/\/$/, '');
    }

    // Fallback en web: usar el mismo origen
    return window.location.origin;
  }

  // 2. En entorno Móvil nativo / Expo Go:
  if (envUrl) {
    return envUrl.replace(/\/$/, '');
  }

  // Fallback desarrollo local móvil
  return 'http://localhost:3001';
};

export class ApiError extends Error {
  constructor(public message: string, public status: number) {
    super(message);
    this.name = 'ApiError';
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  const token = await AsyncStorage.getItem('jwt_token');
  const headers = new Headers(options.headers || {});
  
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const baseUrl = getApiUrl();
  const url = `${baseUrl}${endpoint}`;

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (netErr: any) {
    console.error('Fetch connection failed:', url, netErr);
    throw new ApiError('No se pudo conectar con el servidor. Verifica que el backend esté activo en el puerto 3001.', 0);
  }

  if (!response.ok) {
    let errorMessage = 'Error en el servidor';
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorData.message || errorMessage;
    } catch {
      // Ignorar si no es JSON
    }
    throw new ApiError(errorMessage, response.status);
  }

  // Si no hay contenido (ej. 204), devolver nulo
  if (response.status === 204) return null;

  return response.json();
}

export const api = {
  get: (endpoint: string, options?: RequestInit) => 
    fetchWithAuth(endpoint, { ...options, method: 'GET' }),
    
  post: (endpoint: string, body?: any, options?: RequestInit) => 
    fetchWithAuth(endpoint, { ...options, method: 'POST', body: JSON.stringify(body) }),
    
  patch: (endpoint: string, body?: any, options?: RequestInit) => 
    fetchWithAuth(endpoint, { ...options, method: 'PATCH', body: JSON.stringify(body) }),

  put: (endpoint: string, body?: any, options?: RequestInit) => 
    fetchWithAuth(endpoint, { ...options, method: 'PUT', body: JSON.stringify(body) }),
    
  delete: (endpoint: string, options?: RequestInit) => 
    fetchWithAuth(endpoint, { ...options, method: 'DELETE' }),
};
