# US-11: Core Event Notification Engine

## Resultado funcional

La implementación usa PostgreSQL como origen canónico de los eventos. Esto cubre mutaciones hechas por el API de conductor, el API administrativo y cualquier integración que actualice las tablas directamente.

```text
trips / trip_detours
        |
        v
trigger transaccional -> trip_operational_events -> PGMQ
                                                   |
                              webhook + cron ------+
                                                   v
                                      notification-worker
                                                   |
                       subscriptions + preferences + devices
                                                   |
                                                   v
                                             FCM HTTP v1
```

Los eventos soportados son:

| Evento | Mutación origen |
|---|---|
| `terminal_departure` | `Scheduled/Pending -> In_Progress` |
| `delay` | estado nuevo `Delayed` |
| `detour` | inserción de un desvío activo o cambio de ruta durante un viaje activo |
| `cancellation` | estado nuevo `Cancelled` |
| `route_restored` | desvío activo resuelto |

Cada evento tiene una clave de deduplicación. La preparación de destinatarios también es idempotente mediante restricciones únicas por evento, pasajero y dispositivo.

## Componentes

- `supabase/migrations/20260821000000_core_event_notification_engine.sql`: tablas, triggers, cola PGMQ, funciones RPC, leases, reintentos y RLS.
- `supabase/functions/notification-worker/index.ts`: consumidor asíncrono y procesamiento por lotes.
- `supabase/functions/_shared/fcm-provider.ts`: autenticación OAuth 2.0 y proveedor FCM HTTP v1.
- `src/modules/notifications`: API de dispositivos, preferencias, suscripciones y bandeja de notificaciones.
- `src/modules/driver-trips`: comandos de salida, retraso, reanudación, desvío, restauración y cancelación.

## Seguridad obligatoria antes del despliegue

La cuenta de servicio usada por FCM debe existir únicamente como secretos de Supabase Edge Functions. No se debe guardar el JSON descargado dentro del repositorio, en Fly.io ni en archivos de configuración versionados.

Si una clave privada se muestra en un chat, log, captura o terminal compartida, debe considerarse comprometida aunque el repositorio nunca la haya contenido. Antes de activar este worker:

1. Revocar o eliminar esa clave en Google Cloud IAM.
2. Crear una clave nueva para la cuenta de servicio con el mínimo acceso requerido para FCM.
3. Reemplazar `FCM_PRIVATE_KEY` en Supabase.
4. Confirmar que el archivo descargado permanezca fuera del repositorio y eliminarlo cuando ya no sea necesario.
5. Mantener `PUSH_NOTIFICATIONS_ENABLED=false` hasta terminar la validación.

La función usa `withSupabase({ auth: "secret" })` y `verify_jwt=false`. Solo acepta una secret API key de Supabase en el header `apikey`; no es un endpoint público.

## Secretos de Edge Functions

Supabase proporciona automáticamente sus credenciales de proyecto. Los secretos adicionales son:

| Variable | Requerida | Valor recomendado inicial |
|---|---:|---|
| `FCM_PROJECT_ID` | Sí | Project ID de Firebase |
| `FCM_CLIENT_EMAIL` | Sí | Email de la cuenta de servicio |
| `FCM_PRIVATE_KEY` | Sí | Clave privada nueva con saltos de línea |
| `PUSH_NOTIFICATIONS_ENABLED` | Sí | `false` |
| `FCM_VALIDATE_ONLY` | No | `true` durante smoke test |
| `FCM_BATCH_SIZE` | No | `500` |
| `FCM_MAX_CONCURRENCY` | No | `20` |
| `FCM_MAX_BATCHES_PER_RUN` | No | `4` |
| `NOTIFICATION_QUEUE_BATCH_SIZE` | No | `5` |
| `NOTIFICATION_EVENT_MAX_AGE_SECONDS` | No | `900` |

Es preferible configurar los valores desde Edge Functions > Secrets. Si se usa CLI, el archivo de variables debe estar fuera del repositorio:

```bash
supabase secrets set --env-file /ruta/segura/fcm-edge.env
```

`SUPABASE_URL`, `SUPABASE_SECRET_KEYS`, `SUPABASE_PUBLISHABLE_KEYS` y `SUPABASE_JWKS` son administrados por Supabase y no deben copiarse a este proyecto para la Edge Function.

## Despliegue seguro

Requisitos: Supabase CLI autenticado, project ref correcto y la nueva clave FCM ya instalada.

```bash
supabase link --project-ref <project-ref>
supabase db push
supabase functions deploy notification-worker --use-api
```

El orden es importante: la migración debe existir antes de ejecutar el worker. El primer despliegue debe conservar `PUSH_NOTIFICATIONS_ENABLED=false`.

## Activación asíncrona

La migración `20260821010000_notification_worker_wakeup.sql` configura dos mecanismos:

- un trigger `AFTER INSERT` sobre `public.trip_operational_events` que despierta inmediatamente al worker mediante `pg_net`;
- un cron cada minuto que recupera eventos si una invocación inmediata falla o coincide con un despliegue.

La llamada asíncrona admite hasta cinco segundos para cubrir el arranque en frío de la Edge Function. El body no es usado como fuente de verdad. El worker reclama mensajes durablemente desde PGMQ. La URL y la secret API key deben guardarse en Supabase Vault antes de activar los envíos y nunca dentro de una migración versionada.

```sql
select vault.create_secret(
  'https://<project-ref>.supabase.co/functions/v1/notification-worker',
  'notification_worker_url'
);

select vault.create_secret(
  '<supabase-secret-api-key>',
  'notification_worker_secret'
);
```

## Contrato del cliente móvil

El proyecto Firebase debe registrar una aplicación Android si el cliente se distribuye en Android y una aplicación iOS si también se distribuye en iOS. Registrar una Web App solo corresponde a un cliente web. La cuenta de servicio pertenece al backend y no sustituye esas aplicaciones cliente.

El cliente obtiene su FID actual, recomendado por FCM, o un registration token durante la transición, y lo sincroniza con:

```http
PUT /api/passenger/push-devices/{installationId}
Authorization: Bearer <passenger-jwt>
Content-Type: application/json

{
  "target_type": "fid",
  "target_value": "<fid>",
  "platform": "android",
  "app_version": "1.0.0"
}
```

`installationId` debe ser un UUID estable generado por la aplicación. El destino FCM no se devuelve en la respuesta del API.

La entrega externa es al menos una vez: si el worker termina después de que FCM acepta el mensaje pero antes de guardar el resultado, puede existir un reintento. El cliente debe deduplicar usando `notification_id` o `event_id`, ambos incluidos en el data payload.

Para recibir alertas de un viaje:

```http
POST /api/passenger/trips/{tripId}/subscription
Authorization: Bearer <passenger-jwt>
Content-Type: application/json

{}
```

Las preferencias pueden ajustarse mediante `PATCH /api/passenger/notification-preferences`. La bandeja persistida se consulta con `GET /api/passenger/notifications` y una entrada propia se marca leída con `PATCH /api/passenger/notifications/{id}/read`.

## Smoke test sin entrega real

1. Confirmar `PUSH_NOTIFICATIONS_ENABLED=true` y `FCM_VALIDATE_ONLY=true`.
2. Registrar un dispositivo de prueba y una suscripción activa al viaje.
3. Iniciar un viaje `Scheduled` o `Pending` con `POST /api/driver/trips/{id}/start`.
4. Verificar que el evento, la notificación y la entrega terminen sin error.
5. Probar `delay`, `detour`, `detour/resolve` y `cancel` con viajes de prueba separados.
6. Revisar los logs de `notification-worker` y las métricas siguientes.
7. Cambiar `FCM_VALIDATE_ONLY=false` y repetir con un dispositivo físico controlado.

Los eventos con más de `NOTIFICATION_EVENT_MAX_AGE_SECONDS` se marcan `dead` y no se envían. Esto evita que una activación posterior emita alertas operativas antiguas acumuladas mientras el worker estaba deshabilitado.

## Observabilidad

```sql
select processing_status, count(*)
from public.trip_operational_events
group by processing_status;

select status, provider_error_code, count(*)
from public.notification_deliveries
group by status, provider_error_code
order by status, provider_error_code;

select * from pgmq.metrics('core_event_notifications');
```

Estados esperados:

- Evento: `queued -> processing -> completed` o `completed_with_failures`.
- Entrega: `pending -> processing -> sent`.
- Error transitorio: `processing -> retry` con backoff y máximo seis intentos.
- Destino inválido: `failed` y dispositivo desactivado.
- Evento vencido: `dead` con `EVENT_EXPIRED`.

Ante una incidencia, configurar inmediatamente `PUSH_NOTIFICATIONS_ENABLED=false`. Los cambios de estado continúan registrándose y encolándose para auditoría; los eventos que superen la ventana máxima no se enviarán al reactivar.

## Referencias

- [Firebase Cloud Messaging HTTP v1](https://firebase.google.com/docs/cloud-messaging/send/v1-api)
- [Firebase: administración de FID y registration tokens](https://firebase.google.com/docs/cloud-messaging/manage-tokens)
- [Supabase Edge Functions: secretos](https://supabase.com/docs/guides/functions/secrets)
- [Supabase Edge Functions: autenticación service-to-service](https://supabase.com/docs/guides/functions/auth)
- [Supabase: programar Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions)
