# Arquitectura modular actual

La implementacion backend se esta consolidando hacia una estructura **feature-first** bajo `src/modules/`.

## Objetivo

- Reducir el acoplamiento entre carpetas tecnicas globales.
- Mantener cada funcionalidad cerca de su controlador, servicio, presentacion y adaptadores.
- Favorecer principios SOLID con dependencias inyectables y puntos de extension claros.

## Estructura

```text
src/
  api/
    createApiRouter.js
  modules/
    auth/
      index.js
    passenger-incidents/
      index.js
    routes/
      index.js
    trips/
      index.js
```

Cada modulo concentra:

- interfaz o contrato abstracto para la dependencia principal
- implementacion concreta para el proveedor actual
- servicio de aplicacion
- controlador HTTP
- fabrica del modulo y router

## Patrones aplicados

- **Dependency Injection**: los servicios reciben repositorios o proveedores externos.
- **Repository Pattern**: los servicios dependen de contratos, no de Supabase directamente.
- **Factory Pattern**: cada modulo expone constructores para crear el router y sus dependencias.
- **Adapter Pattern**: las implementaciones concretas envuelven los repositorios o clientes existentes.

## Compatibilidad transitoria

Las carpetas historicas `controllers/`, `services/`, `views/` y parte de `routes/` siguen presentes como adaptadores delgados para no romper pruebas ni imports existentes. El codigo nuevo debe entrar primero en `src/modules/`.

## Siguientes pasos recomendados

1. mover `repositories/` a adaptadores por modulo cuando se aborde la persistencia restante
2. migrar pruebas para apuntar directamente a `src/modules/`
3. eliminar adaptadores transitorios una vez que no existan imports legacy
4. completar los modulos faltantes de telemetria, tickets, notificaciones y monitoreo