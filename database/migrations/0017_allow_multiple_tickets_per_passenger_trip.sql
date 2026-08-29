-- Restore support for buying multiple tickets for the same passenger and trip.
-- The checkout service intentionally creates a distinct ticket and QR for each purchase.

drop index if exists public.uq_tickets_generated_per_passenger_trip;
