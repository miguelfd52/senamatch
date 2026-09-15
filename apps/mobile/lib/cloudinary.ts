import { Platform } from 'react-native';

export type CloudinaryResult = {
  secure_url: string;
  public_id: string;
  format: string;
  bytes: number;
};

export class CloudinaryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CloudinaryError';
  }
}

const TIPOS_VALIDOS = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const TIPO_NOMBRES = 'JPG, JPEG, PNG o WebP';
const MAX_BYTES = 3 * 1024 * 1024; // 3 MB

function getCloudName(): string {
  const envVal = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const clean = envVal ? String(envVal).trim().replace(/^['"]|['"]$/g, '') : '';
  if (!clean || clean.toLowerCase() === 'senamatch') {
    return 'jsts4pi6';
  }
  return clean;
}

function getUploadPreset(): string {
  const envVal = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
  const clean = envVal ? String(envVal).trim().replace(/^['"]|['"]$/g, '') : '';
  return clean || 'senamatch_images';
}

/**
 * Sube un archivo File (web) a Cloudinary mediante unsigned upload.
 * Valida tipo y tamaño antes de subir.
 * Retorna { secure_url } con la URL HTTPS permanente.
 */
export async function uploadFileToCloudinary(file: File): Promise<CloudinaryResult> {
  // Validar tipo
  if (!TIPOS_VALIDOS.includes(file.type.toLowerCase())) {
    throw new CloudinaryError(`Solo se permiten imágenes en formato ${TIPO_NOMBRES}. Tipo recibido: ${file.type || 'desconocido'}`);
  }

  // Validar tamaño
  if (file.size > MAX_BYTES) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    throw new CloudinaryError(`La imagen supera el límite de 3 MB (tamaño actual: ${sizeMB} MB). Comprime la imagen e inténtalo de nuevo.`);
  }

  const cloudName = getCloudName();
  const uploadPreset = getUploadPreset();
  const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

  // En web, forzar el uso del FormData nativo del navegador (window.FormData)
  const form = (typeof window !== 'undefined' && (window as any).FormData)
    ? new (window as any).FormData()
    : new FormData();

  form.append('file', file);
  form.append('upload_preset', uploadPreset);
  form.append('folder', 'senamatch');

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      body: form,
    });
  } catch (netErr: any) {
    throw new CloudinaryError('No se pudo conectar con Cloudinary. Verifica tu conexión a internet.');
  }

  if (!response.ok) {
    let errorMsg = `HTTP ${response.status}`;
    try {
      const errData = await response.json();
      if (errData?.error?.message) {
        errorMsg = errData.error.message;
      }
    } catch {
      // Ignorar fallo de parseo JSON
    }
    // Registrar solo status y mensaje para diagnóstico, sin claves ni datos privados
    console.error(`[Cloudinary] status: ${response.status}, message: ${errorMsg}`);
    throw new CloudinaryError(`Error al subir la imagen (${response.status}): ${errorMsg}`);
  }

  const data = await response.json() as CloudinaryResult;
  if (!data.secure_url) {
    throw new CloudinaryError('Cloudinary no devolvió una URL válida. Intenta de nuevo.');
  }

  return data;
}

/**
 * Sube desde un Data URL (base64) a Cloudinary.
 * Útil como fallback si el File no está disponible.
 */
export async function uploadDataUrlToCloudinary(dataUrl: string): Promise<CloudinaryResult> {
  const cloudName = getCloudName();
  const uploadPreset = getUploadPreset();
  const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

  // Validar formato del data URL
  const match = dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,/);
  if (!match) {
    throw new CloudinaryError('El archivo seleccionado no es una imagen válida.');
  }

  const mimeType = match[1].toLowerCase();
  if (!TIPOS_VALIDOS.includes(mimeType)) {
    throw new CloudinaryError(`Solo se permiten imágenes en formato ${TIPO_NOMBRES}.`);
  }

  // Estimar tamaño (base64 → ~75% del original)
  const base64Data = dataUrl.split(',')[1] || '';
  const estimatedBytes = Math.floor(base64Data.length * 0.75);
  if (estimatedBytes > MAX_BYTES) {
    const sizeMB = (estimatedBytes / (1024 * 1024)).toFixed(1);
    throw new CloudinaryError(`La imagen supera el límite de 3 MB (~${sizeMB} MB estimado). Comprime la imagen e inténtalo de nuevo.`);
  }

  const form = (typeof window !== 'undefined' && (window as any).FormData)
    ? new (window as any).FormData()
    : new FormData();

  form.append('file', dataUrl);
  form.append('upload_preset', uploadPreset);
  form.append('folder', 'senamatch');

  let response: Response;
  try {
    response = await fetch(url, { method: 'POST', body: form });
  } catch (netErr: any) {
    throw new CloudinaryError('No se pudo conectar con Cloudinary. Verifica tu conexión a internet.');
  }

  if (!response.ok) {
    let errorMsg = `HTTP ${response.status}`;
    try {
      const errData = await response.json();
      if (errData?.error?.message) {
        errorMsg = errData.error.message;
      }
    } catch {
      // Ignorar fallo de parseo JSON
    }
    console.error(`[Cloudinary] status: ${response.status}, message: ${errorMsg}`);
    throw new CloudinaryError(`Error al subir la imagen (${response.status}): ${errorMsg}`);
  }

  const data = await response.json() as CloudinaryResult;
  if (!data.secure_url) {
    throw new CloudinaryError('Cloudinary no devolvió una URL válida. Intenta de nuevo.');
  }

  return data;
}

/**
 * Wrapper para web: abre selector de archivo y sube a Cloudinary.
 * Llama onProgress(true/false) para controlar estado de carga.
 * Llama onSuccess(secure_url) con la URL permanente.
 * Llama onError(msg) si falla.
 */
export function openImagePickerAndUpload(options: {
  onProgress: (loading: boolean) => void;
  onSuccess: (secureUrl: string) => void;
  onError: (msg: string) => void;
  onPreview?: (dataUrl: string) => void;
}) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    options.onError('La subida de fotos desde archivo solo está disponible en el navegador.');
    return;
  }

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/jpeg,image/png,image/webp';

  input.onchange = async (e: any) => {
    const file: File | undefined = e.target?.files?.[0];
    if (!file) return;

    // Mostrar preview inmediata antes de subir
    if (options.onPreview) {
      const reader = new FileReader();
      reader.onloadend = () => {
        options.onPreview!(reader.result as string);
      };
      reader.readAsDataURL(file);
    }

    options.onProgress(true);
    try {
      const result = await uploadFileToCloudinary(file);
      options.onSuccess(result.secure_url);
    } catch (err: any) {
      options.onError(err.message || 'Error desconocido al subir la foto.');
    } finally {
      options.onProgress(false);
    }
  };

  input.click();
}
