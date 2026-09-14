import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// En Expo Web el navegador y el backend viven en el mismo equipo: usar
// localhost evita que Windows bloquee la conexión hacia su propia IP Wi-Fi.
// En Expo Go se conserva la IP de la red definida en .env.
const getApiUrl = () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.hostname) {
    const host = window.location.hostname;
    return `http://${host}:3001`;
  }
  return process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';
};

const API_URL = getApiUrl();

export class ApiError extends Error {
  constructor(public message: string, public status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  const token = await AsyncStorage.getItem('jwt_token');
  const headers = new Headers(options.headers || {});
  
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

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
    
  delete: (endpoint: string, options?: RequestInit) => 
    fetchWithAuth(endpoint, { ...options, method: 'DELETE' }),
};
