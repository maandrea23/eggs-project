# Migración a Java + Spring Boot + Angular

La implementación nueva vive en dos aplicaciones independientes:

- `backend/`: API REST Java 21 y Spring Boot. Organiza dominio, aplicación, infraestructura e interfaces REST.
- `frontend/`: cliente Angular con rutas protegidas, JWT y pantallas para operación diaria, ventas, gastos y usuarios.

## Roles

| Rol | Permisos |
| --- | --- |
| `OPERATOR` | Crear únicamente la recolección del día actual. |
| `ADMIN` | Consultar y corregir recolecciones; gestionar stock, ventas y gastos. |
| `OWNER` | Todos los permisos, incluyendo usuarios y eliminaciones. |

Cada alta, corrección o eliminación queda preparada para registrarse en `audit_event`.

## Ejecutar localmente

1. Define contraseñas propias en `docker-compose.local.yml` o usa un archivo `.env` fuera del control de versiones.
2. Ejecuta `docker compose -f docker-compose.local.yml up --build`.
3. Abre Angular en `http://localhost:4200` y Spring Boot en `http://localhost:8080`.

El dueño inicial se crea a partir de `OWNER_USERNAME` y `OWNER_PASSWORD` la primera vez que inicia una base de datos vacía.

## Datos de la versión anterior

La app Next.js actual se conserva durante la transición. Antes de apagarla, exporta los registros de recolección, ventas y gastos desde ella. Luego se importan en la API nueva respetando las fechas y los tipos de huevo. No se debe borrar la base de datos anterior hasta validar los conteos de producción, stock y ventas contra la nueva aplicación.
