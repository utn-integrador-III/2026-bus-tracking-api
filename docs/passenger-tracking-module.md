# Módulo de Seguimiento del Pasajero (Passenger Tracking)

Backend del seguimiento en vivo de un viaje por parte del **Pasajero** (US-03). Permite
previsualizar viajes activos, vigilar una parada seleccionada y recibir alertas en tiempo real
cuando el bus **se acerca** o **rebasa** esa parada, recalculando/redirigiendo el estado de
seguimiento hacia la siguiente parada de la ruta.

Requerimientos cubiertos: **FR-21** (alertas de proximidad por geocerca), lógica de redirección
de US-03 (alerta al pasar la parada + recálculo del estado de seguimiento), **NFR-02** (JWT en
cada request). El preview y la vigilancia de paradas **no** disparan ningún bloqueo de ticket.

## Endpoints

| Método | Ruta | Rol | Descripción | Respuesta |
|---|---|---|---|---|
| `GET` | `/api/passenger/tracking/trips/preview` | Autenticado | Viajes activos con su ruta (geometría) para el mapa. Sin ticket. | `200` · array de viajes con `route` |
| `POST` | `/api/passenger/tracking/trips/:id/watch-stop` | Autenticado | Registra la vigilancia de una parada del viaje. Body: `{ "stop_id": "<uuid>" }`. | `201` · registro del watch |

## Máquina de estados de la vigilancia (`passenger_trip_watches.status`)

Cada vigilancia avanza según la posición del bus respecto a la geocerca de la parada
(`stops.geofence_radius_meters`, por defecto 500 m si no está configurado). La distancia se
calcula con la fórmula de Haversine (`utils/distance.js`).

```
waiting  --(el bus ENTRA en la geocerca: distancia <= radio)-->  alerted
alerted  --(el bus SALE de la geocerca: distancia > radio)----->  passed | (redirigido a waiting)
```

- **`waiting` → `alerted`:** el bus entra en la geocerca de la parada vigilada. Se emite el
  evento `bus_approaching` al canal `passenger:{userId}:alerts`.
- **`alerted` → rebasada:** el bus, tras haber estado dentro, vuelve a salir de la geocerca. Se
  interpreta como que **pasó la parada**. Se emite `bus_passed` y se **redirige el estado de
  seguimiento**:
  - Si existe una parada siguiente en la ruta (`stop_order` mayor), la vigilancia se
    **redirige** a esa parada (`stop_id` = siguiente, `status` = `waiting`) y el payload incluye
    `redirected: true` con los datos de `next_stop`.
  - Si no hay parada siguiente (era la última / destino), la vigilancia queda en `passed`
    (terminal) y el payload lleva `redirected: false`, `next_stop: null`.

La detección de entrada/salida evita falsas alertas: solo se considera "rebasada" una parada
que el bus primero **alcanzó** (entró en la geocerca) y luego **dejó atrás**.

## Eventos de tiempo real (`passenger:{userId}:alerts`)

| Evento | Payload |
|---|---|
| `bus_approaching` | `{ trip_id, stop_id }` |
| `bus_passed` | `{ trip_id, stop_id, redirected, next_stop }` |

## Integración con la telemetría del conductor

`DriverTripService.reportLocation()` invoca `PassengerTrackingService.checkProximity(tripId, lat, lng)`
en cada reporte de ubicación del conductor. El chequeo consulta las vigilancias no terminales del
viaje (`waiting` + `alerted`), evalúa la geocerca y dispara las transiciones/alertas anteriores.
Los errores del chequeo se registran sin interrumpir el flujo de telemetría del conductor.

## Notas de implementación

- La lógica de decisión vive en `services/tracking.service.js` (sin acceso a BD, testeable en
  aislamiento). El acceso a datos vive en `infrastructure/SupabaseTripWatchRepository.js`.
- Pruebas unitarias del servicio: `services/__tests__/tracking.service.test.js`.
- **Persistencia:** la tabla `passenger_trip_watches` se crea en
  `database/migrations/0005_passenger_trip_watches.sql` (id, user_id, trip_id, stop_id, status
  `waiting|alerted|passed`, alerted_at, created_at; único `(user_id, trip_id)` para el upsert;
  índice `(trip_id, status)`; RLS por dueño). El acceso desde el backend usa el service client,
  que opera con rol de servicio.
