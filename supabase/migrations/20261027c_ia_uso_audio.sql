-- 27 oct 2026: segundos de audio en ia_uso, para ver el costo real de Groq Whisper
-- (cobra por hora de audio, no por tokens). Una fila por tramo transcrito, tipo 'transcripcion_audio'.
alter table public.ia_uso
  add column if not exists audio_segundos numeric(10,1) not null default 0;
