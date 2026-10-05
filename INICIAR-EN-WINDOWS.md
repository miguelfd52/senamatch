# Iniciar SENA Match

Tienes dos formas de iniciar el proyecto:

### Opción 1: Iniciar todo en una sola terminal (Recomendado)

En la raíz del proyecto:
```powershell
npm run dev
```
Esto levantará simultáneamente el servidor backend (puerto 3001) y la aplicación Expo.

---

### Opción 2: Iniciar en dos terminales separadas

**Terminal 1: Backend (Node.js + MongoDB)**
```powershell
npm run dev:server
```
Espera estos mensajes:
```text
🚀 Servidor SENA Match corriendo en http://localhost:3001
✅ Conectado a MongoDB Atlas
```

**Terminal 2: Aplicación Expo (Mobile / Web)**
```powershell
npm run dev:mobile
```
(O para abrir directamente en el navegador web: `npm run start --workspace apps/mobile -- --web`)

En Expo Go, el celular y el computador deben estar conectados a la misma red Wi-Fi. La dirección de la API ya está configurada en `apps/mobile/.env` para este computador. Si la red cambia, actualiza la IP allí.

## Prueba rápida

1. Escanea el código QR con Expo Go.
2. Pulsa **Crear cuenta**.
3. Usa un correo terminado en `@gmail.com`, `@misena.edu.co` o `@sena.edu.co` y una contraseña de mínimo 8 caracteres.
4. Cierra sesión e inicia sesión con la misma cuenta.
