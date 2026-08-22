# Brianna Eggs Farm Manager

Aplicación única con Next.js: la interfaz, el inicio de sesión y las rutas de datos viven en este mismo proyecto.

## Desarrollo

```bash
npm install
npm run dev
```

La app y sus rutas API estarán en `http://localhost:3000`.

## Variables de entorno

Copia `.env.example` a `.env.local` y define las credenciales Owner. En Dailey OS, configura `OWNER_USERNAME`, `OWNER_PASSWORD` y conserva activada la base MySQL administrada.

## Rutas API

- `POST /api/auth/owner`
- `GET /api/farm-state`
- `PUT /api/farm-state`
