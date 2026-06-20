# Documentación de la API (Swagger / OpenAPI)

La API expone su contrato como un documento **OpenAPI 3.0.3** y una interfaz **Swagger UI**
interactiva. Cubre los endpoints actuales del módulo de Rutas más `GET /health`.

## Cómo acceder

Con el servidor levantado (`npm run dev`, por defecto en `http://localhost:8000`):

| Recurso | URL | Descripción |
|---|---|---|
| Swagger UI | `http://localhost:8000/api/docs` | Interfaz interactiva (probar endpoints). |
| Spec JSON | `http://localhost:8000/api/docs.json` | Documento OpenAPI crudo (para importar a Postman/Insomnia o generar clientes). |

Ambos se sirven **sin autenticación** (solo exponen el contrato, no datos).

## Cómo está construido

- **Sin `swagger-jsdoc`.** La política de cero-comentarios del repo prohíbe comentarios en
  el código `.js`, y `swagger-jsdoc` se basa en anotaciones JSDoc. En su lugar, el documento
  OpenAPI se define como un **objeto JavaScript plano** en `config/openapi.js` (los textos
  viven en campos `description`, que son strings válidos, no comentarios).
- **`swagger-ui-express`** monta la UI y se le pasa el documento ya construido.
- El montaje vive en `app.js`, justo después de `GET /health` y antes del router `/api`.

```
config/openapi.js   →  documento OpenAPI (objeto JS)
app.js              →  GET /api/docs.json  +  GET /api/docs (Swagger UI)
```

Al agregar nuevos endpoints, se actualiza `config/openapi.js` (paths + schemas en
`components.schemas`). El test `routes/__tests__/swagger.integration.test.js` verifica que el
spec se sirva y que documente los endpoints existentes.

## Autenticación en la documentación

El spec declara dos esquemas de seguridad:

- **`bearerAuth`** — `Authorization: Bearer <jwt>` (Supabase Auth). Modo de producción.
- **`devUserId` / `devRole`** — cabeceras `x-dev-user-id` y `x-dev-role`, **solo** cuando
  `AUTH_DEV_BYPASS=true` (desarrollo local). Permiten probar el CRUD desde Swagger UI sin
  Supabase Auth usando el botón **Authorize**.

El rol nunca se lee del body: se resuelve desde el token (o el bypass) — ver
[`docs/routes-module.md`](routes-module.md).
