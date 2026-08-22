-- Bucket privado para las cédulas de adultos mayores.
-- Convención de ruta: cedulas/{auth.uid()}/<archivo>
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cedulas',
  'cedulas',
  false,
  5242880,  -- 5 MB
  ARRAY['image/jpeg','image/png','image/webp','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Subir: cada usuario autenticado solo dentro de su propia carpeta.
CREATE POLICY "cedulas_insert_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'cedulas'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Leer: el dueño de la carpeta o cualquier administrador.
CREATE POLICY "cedulas_select_own_or_admin"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'cedulas'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_admin()
    )
  );

-- Actualizar/reemplazar: solo dentro de su propia carpeta.
CREATE POLICY "cedulas_update_own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'cedulas'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'cedulas'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Borrar: el dueño o un administrador.
CREATE POLICY "cedulas_delete_own_or_admin"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'cedulas'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_admin()
    )
  );;
