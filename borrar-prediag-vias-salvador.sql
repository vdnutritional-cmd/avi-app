-- Borra prediagnóstico (original + actual) y plan de sesiones/vías de acción
-- del paciente salvador@vdproducts.net en la sección Individual del EXPEDIENTE.

UPDATE patient_expediente
SET
  -- Prediagnóstico actual (6 campos)
  individual_prediag_impresion   = NULL,
  individual_prediag_diagnostico = NULL,
  individual_prediag_areas       = NULL,
  individual_prediag_tipo        = NULL,
  individual_prediag_detonadores = NULL,
  individual_prediag_guia        = NULL,
  -- Prediagnóstico original (snapshot inmutable)
  individual_prediag_original    = NULL,
  -- Plan de sesiones / Vías de acción (actual + original)
  individual_vias_accion         = NULL,
  individual_vias_original       = NULL,
  updated_at                     = now()
WHERE patient_id = (
  SELECT id FROM auth.users WHERE email = 'salvador@vdproducts.net'
);
