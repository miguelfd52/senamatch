# Iniciar SENA Match

Abre dos terminales de PowerShell en la carpeta raíz del proyecto.

## Terminal 1: backend y MongoDB

```powershell
npm install --prefix server
npm run dev:server
```

Espera estos mensajes antes de abrir la aplicación:

```text
🚀 Servidor SENA Match corriendo en http://localhost:3001
✅ Conectado a MongoDB Atlas
```

## Terminal 2: aplicación Expo

```powershell
npm install
npm run dev
```

En Expo Go, el celular y el computador deben estar conectados a la misma red Wi-Fi. La dirección de la API ya está configurada en `apps/mobile/.env` para este computador. Si la red cambia, actualiza la IP allí.

## Prueba rápida

1. Escanea el código QR con Expo Go.
2. Pulsa **Crear cuenta**.
3. Usa un correo terminado en `@gmail.com`, `@misena.edu.co` o `@sena.edu.co` y una contraseña de mínimo 8 caracteres.
4. Cierra sesión e inicia sesión con la misma cuenta.
