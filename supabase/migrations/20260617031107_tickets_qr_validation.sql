-- FR-22-QR: token del QR cifrado, distinto del UUID crudo del boleto.
-- FR-14-QR: registrar qué conductor validó el boleto al abordar.
ALTER TABLE public.tickets
  ADD COLUMN qr_token   text,
  ADD COLUMN scanned_by uuid,
  ADD CONSTRAINT tickets_scanned_by_fkey FOREIGN KEY (scanned_by)
    REFERENCES public.users (id) DEFERRABLE INITIALLY IMMEDIATE;

CREATE UNIQUE INDEX uq_tickets_qr_token ON public.tickets (qr_token) WHERE qr_token IS NOT NULL;;
