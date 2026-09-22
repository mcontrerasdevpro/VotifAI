-- Guarda el acta final también como PDF (además del texto plano ya
-- existente en acta_texto_final), con membrete del despacho, para poder
-- adjuntarlo al email/WhatsApp de cierre y para descargarlo después.
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS acta_pdf_base64 TEXT;
