# Brianna Eggs Farm Manager

La aplicación está separada en dos servicios TypeScript para conservar una interfaz independiente de la lógica de negocio y la base de datos.

```text
frontend/   Next.js + React (interfaz de usuario)
backend/    Node.js + Express (API y MySQL)
```

## Ejecutar en desarrollo

Abre dos terminales desde esta carpeta:

```bash
npm --prefix backend install
npm --prefix backend run dev
```

```bash
npm --prefix frontend install
npm --prefix frontend run dev
```

El frontend estará en `http://localhost:3000` y la API en `http://localhost:4000`.

Configura `backend/.env` tomando como referencia `backend/.env.example`. Para el frontend, usa `frontend/.env.local` a partir de `frontend/.env.example` si la API no está en `http://localhost:4000`.

## Docker

1. Copia `.env.example` como `.env` y cambia las contraseñas.
2. Inicia los servicios:

```bash
docker compose up --build
```

Docker levanta el frontend en el puerto `3000`, la API en el `4000` y MySQL en el `3306`.

## API

- `GET /api/health` — confirma disponibilidad de la API.
- `POST /api/auth/owner` — valida el usuario y contraseña del propietario.
- `GET /api/farm-state` — obtiene el estado completo de la granja.
- `PUT /api/farm-state` — guarda el estado completo de la granja.
