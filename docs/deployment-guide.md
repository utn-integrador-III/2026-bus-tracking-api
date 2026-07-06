# Guia de despliegue automatizado del backend

Este documento describe como desplegar la API backend en la nube utilizando contenedores Docker y pipelines CI/CD automatizados. El flujo esta disenado para que cualquier merge a la rama main dispare un despliegue automatico sin intervencion manual.

## Arquitectura del despliegue

```
Browser (React Native / Web)
    |
    |  (fetch API)
    v
Backend (Node/Express en Fly.io)
    https://bus-tracking-api.fly.dev
    |
    v
Supabase (PostgreSQL gestionado)
```

Repositorio: github.com/utn-integrador-III/2026-bus-tracking-api

---

## Evaluacion de guias existentes

Se revisaron las siguientes guias de deployment desarrolladas por el equipo:

1. Guia de Fly.io + Docker (2026-deployment-automation): Utiliza Fly.io como plataforma de contenedores, Docker para empaquetar la aplicacion, y flyctl para el despliegue manual o automatizado.

2. Guias en Teams: Documentacion adicional sobre configuracion de Supabase y variables de entorno.

Conclusion: La guia de Fly.io + Docker es la que mejor se adapta a la arquitectura del proyecto porque:

- Usa Node.js, que es el stack del backend.
- Soporta contenedores Docker, ideales para entornos de produccion.
- Permite escalar a cero cuando no hay uso (costo minimo).
- Incluye manejo de secretos encriptados (fly secrets set).
- Provee health checks y auto-reinicio.
- Es compatible con GitHub Actions para CI/CD.

---

## Tecnologias y servicios utilizados

| Componente | Tecnologia | Proveedor cloud |
|---|---|---|
| Backend API | Node.js 22 + Express 5 | Fly.io |
| Base de datos | Supabase (PostgreSQL) | Supabase cloud |
| CI/CD | GitHub Actions + Flyctl | GitHub Actions |
| Codigo fuente | Git + GitHub | GitHub |

No se requieren tecnologias adicionales. Fly.io es la plataforma mas adecuada para este stack y esta alineada con las tecnologias existentes del proyecto.

---

## Despliegue del Backend (Fly.io)

### Prerequisitos

1. Una cuenta en Fly.io (https://fly.io/app/sign-up). Se requiere metodo de pago incluso para el plan gratuito. Los costos son minimos porque la app escala a cero cuando esta inactiva.

2. Fly CLI instalado localmente:

   Windows (PowerShell):
   powershell -Command "iwr https://fly.io/install.sh -useb | iex"

   macOS / Linux:
   curl -L https://fly.io/install.sh | sh

3. Autenticarse en Fly.io:

   fly auth login

### Archivos de configuracion incluidos en el repositorio

El repositorio del backend incluye tres archivos necesarios para el despliegue:

- Dockerfile: Define como construir la imagen del contenedor. Usa construccion multi-etapa: primero instala dependencias de produccion, luego copia solo lo necesario a una imagen limpia. Escucha en el puerto 8000 y ejecuta node index.js.

- fly.toml: Configuracion de la aplicacion en Fly.io. Define el nombre de la app, region primaria, puerto interno, health checks, y recursos de la maquina virtual.

- .dockerignore: Lista de archivos y directorios que NO deben incluirse en la imagen Docker (node_modules, .env, .git, etc.).

### Configuracion inicial (solo la primera vez)

1. Abrir el archivo fly.toml y cambiar el valor de "app" por un nombre unico global. Ejemplo:

   app = "bus-tracking-api-nombre-del-equipo"

2. Crear la aplicacion en Fly.io:

   fly launch --no-deploy

   Responder "No" cuando pregunte si necesita base de datos o Redis. Esto crea la app en Fly.io sin desplegar aun.

3. Configurar las variables de entorno sensibles como secretos encriptados:

   fly secrets set SUPABASE_URL="https://tu-proyecto.supabase.co"
   fly secrets set SUPABASE_ANON_KEY="tu-clave-anon"
   fly secrets set SUPABASE_SERVICE_ROLE_KEY="tu-clave-service-role"
   fly secrets set JWT_SECRET_KEY="tu-clave-jwt"
   fly secrets set GOOGLE_MAPS_API_KEY="tu-clave-google-maps"

   Las variables no sensibles (APP_PORT, APP_ENV, etc.) se configuran directamente en fly.toml dentro de la seccion [env].

### Despliegue manual

Una vez configurado, para desplegar manualmente:

fly deploy

Esto envia el codigo a Fly.io, construye la imagen Docker en sus servidores remotos, y la pone en ejecucion. No se necesita Docker instalado localmente.

### Verificar el despliegue

fly status
fly logs
fly open

Probar que el health check funciona:

curl https://tu-app.fly.dev/health

Deberia devolver: {"status":"ok"}

### Despliegue automatico (CI/CD)

El pipeline de CI/CD para el backend esta definido en .github/workflows/deploy-backend.yml. Se ejecuta automaticamente cuando hay un push a la rama main (despues de un merge de qa a main).

Flujo completo:

1. Un desarrollador crea una rama feature/* desde dev.
2. Trabaja en su funcionalidad y abre un Pull Request a dev.
3. CI se ejecuta en el PR (lint, pruebas, verificacion de comentarios).
4. Al mergear a dev, CI se ejecuta nuevamente.
5. Se abre un PR de dev a qa para pruebas de integracion.
6. Se abre un PR de qa a main cuando todo esta listo.
7. Al mergear a main, CI se ejecuta y luego CD despliega automaticamente a Fly.io.

Para activar el despliegue automatico, se debe agregar un secreto en GitHub:

1. Ir a Settings > Secrets and variables > Actions en el repositorio de GitHub.
2. Agregar un nuevo secreto llamado FLY_API_TOKEN.
3. El valor se obtiene ejecutando localmente: fly tokens create deploy

### Escalamiento y mantenimiento

Cambiar el numero de maquinas:

fly scale count 2

Cambiar memoria:

fly scale memory 512

Ver recursos actuales:

fly scale show

Ver logs en vivo:

fly logs

---

## Pipeline CI/CD

Evento: Push a main
1. CI corre lint, pruebas, zero-comments check y env drift check.
2. CD (deploy-backend.yml) construye la imagen Docker y la despliega en Fly.io.

Archivos involucrados:
- .github/workflows/ci.yml (lint, test, env check)
- .github/workflows/deploy-backend.yml (deploy a Fly.io)
- Dockerfile (definicion de la imagen)
- fly.toml (configuracion de Fly.io)

---

## Guia paso a paso: deploy desde cero

### Paso 1: Configurar Supabase

Supabase es el unico servicio externo que no se despliega, se configura manualmente:

1. Crear un proyecto en https://supabase.com.
2. Obtener las credenciales (URL, anon key, service role key) desde Project Settings > API.
3. Crear las tablas necesarias usando las migraciones en database/migrations/.
4. Configurar Row Level Security (RLS) para proteger los datos.

### Paso 2: Desplegar el backend

1. Clonar el repositorio del backend.
2. Instalar dependencias: npm install.
3. Crear archivo .env a partir de .env.example con las credenciales de Supabase y Google Maps.
4. Verificar que la app funcione localmente: npm run dev.
5. Configurar Fly.io (ver seccion "Configuracion inicial").
6. Desplegar: fly deploy.
7. Verificar: curl https://tu-app.fly.dev/health.

### Paso 3: Configurar CI/CD del backend

1. En GitHub, ir a Settings > Secrets and variables > Actions.
2. Agregar FLY_API_TOKEN con el token generado con fly tokens create deploy.
3. Hacer un push a main para verificar que el pipeline se ejecute.

---

## Mantenimiento y operaciones

### Actualizar el backend

1. Hacer cambios en una rama feature/*.
2. Seguir el flujo de ramas: feature/* -> dev -> qa -> main.
3. Al mergear a main, el pipeline CI/CD despliega automaticamente.

### Rollback

Fly.io permite hacer rollback a una version anterior:

fly deploy --image registry.fly.io/nombre-app:deployment-01XXXXX

### Monitoreo

Fly.io: fly logs para logs en tiempo real.
Supabase: Dashboard > Database > Reports para monitoreo de base de datos.

### Costos aproximados

Fly.io (compartido, escala a cero): Gratuito hasta 3 aplicaciones con 256MB RAM cada una.
Supabase (Free): 500MB de base de datos, 2GB de ancho de banda.
Total estimado: $0/mes para un proyecto academico.

---

## Referencias

- Documentacion oficial de Fly.io: https://fly.io/docs
- Documentacion oficial de Supabase: https://supabase.com/docs
- Guia original de despliegue con Fly.io: github.com/utn-integrador-III/2026-deployment-automation
- Flujo de ramas Git: docs/git-workflow.md en el repositorio del backend
- Arquitectura del proyecto: docs/architecture-modules.md
