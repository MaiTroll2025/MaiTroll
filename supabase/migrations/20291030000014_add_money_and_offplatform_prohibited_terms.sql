-- Add money solicitation and off-platform contact prohibited terms
INSERT INTO public.moderation_prohibited_terms (term, normalized_term, category, severity, is_context_sensitive, is_active)
VALUES
  -- Money solicitation / financial scam solicitation
  ('cashapp', 'cashapp', 'scam', 'severe', false, true),
  ('venmo', 'venmo', 'scam', 'severe', false, true),
  ('paypal', 'paypal', 'scam', 'severe', false, true),
  ('zelle', 'zelle', 'scam', 'severe', false, true),
  ('moneygram', 'moneygram', 'scam', 'severe', false, true),
  ('westernunion', 'westernunion', 'scam', 'severe', false, true),
  ('findom', 'findom', 'scam', 'severe', false, true),
  ('onlyfans', 'onlyfans', 'scam', 'severe', false, true),
  ('sugardaddy', 'sugardaddy', 'scam', 'severe', false, true),
  ('sugarbaby', 'sugarbaby', 'scam', 'severe', false, true),
  -- Off-platform contact solicitation
  ('whatsapp', 'whatsapp', 'off_platform', 'severe', false, true),
  ('telegram', 'telegram', 'off_platform', 'severe', false, true),
  ('snapchat', 'snapchat', 'off_platform', 'severe', false, true),
  ('discord', 'discord', 'off_platform', 'severe', false, true),
  ('kik', 'kik', 'off_platform', 'severe', false, true)
ON CONFLICT (term) DO UPDATE
  SET category = EXCLUDED.category,
      severity = EXCLUDED.severity,
      is_context_sensitive = EXCLUDED.is_context_sensitive,
      is_active = EXCLUDED.is_active,
      updated_at = now();
