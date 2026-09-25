-- Troll Pets: free engagement layer over existing profiles, wallet, XP, raids, and notifications.

CREATE TABLE IF NOT EXISTS public.pets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pet_type TEXT NOT NULL CHECK (pet_type IN ('dog', 'cat')),
  name TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 32),
  care_status INTEGER NOT NULL DEFAULT 100 CHECK (care_status BETWEEN 0 AND 100),
  needs JSONB NOT NULL DEFAULT '{"hunger": false, "walk": false, "care": false}'::jsonb,
  pet_level INTEGER NOT NULL DEFAULT 1 CHECK (pet_level >= 1),
  training_xp BIGINT NOT NULL DEFAULT 0 CHECK (training_xp >= 0),
  learned_abilities JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_primary BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_care_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_primary_pet_per_owner
  ON public.pets (owner_id)
  WHERE is_primary = true AND is_active = true;

CREATE INDEX IF NOT EXISTS idx_pets_owner_active ON public.pets (owner_id, is_active);

ALTER TABLE public.pets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pet owners can read their pets"
  ON public.pets FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY "Public can read active pet summaries"
  ON public.pets FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE TABLE IF NOT EXISTS public.pet_care_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL UNIQUE REFERENCES public.pets(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agreement_version TEXT NOT NULL,
  accepted BOOLEAN NOT NULL DEFAULT false,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((accepted = true AND accepted_at IS NOT NULL) OR accepted = false)
);

ALTER TABLE public.pet_care_agreements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can read pet care agreements"
  ON public.pet_care_agreements FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

CREATE TABLE IF NOT EXISTS public.pet_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  interaction_type TEXT NOT NULL CHECK (interaction_type IN ('feed', 'walk', 'care')),
  status_delta INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pet_interactions_pet_created
  ON public.pet_interactions (pet_id, created_at DESC);

ALTER TABLE public.pet_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can read pet interactions"
  ON public.pet_interactions FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

CREATE TABLE IF NOT EXISTS public.pet_abuse_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE RESTRICT,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  status_at_report INTEGER NOT NULL CHECK (status_at_report BETWEEN 0 AND 100),
  penalty_coins BIGINT NOT NULL DEFAULT 100 CHECK (penalty_coins = 100),
  ledger_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pet_id, reporter_id)
);

ALTER TABLE public.pet_abuse_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can read pet abuse actions"
  ON public.pet_abuse_actions FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id OR auth.uid() = reporter_id);

CREATE OR REPLACE FUNCTION public.adopt_troll_pet(
  p_pet_type TEXT,
  p_name TEXT,
  p_agreement_version TEXT
)
RETURNS public.pets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pet public.pets;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_pet_type NOT IN ('dog', 'cat') THEN RAISE EXCEPTION 'Choose a dog or cat'; END IF;
  IF p_agreement_version IS NULL OR trim(p_agreement_version) = '' THEN RAISE EXCEPTION 'Pet-care agreement is required'; END IF;
  IF EXISTS (SELECT 1 FROM public.pets WHERE owner_id = auth.uid() AND is_primary = true AND is_active = true) THEN
    RAISE EXCEPTION 'You already have a primary pet';
  END IF;

  INSERT INTO public.pets (owner_id, pet_type, name)
  VALUES (auth.uid(), p_pet_type, trim(p_name))
  RETURNING * INTO v_pet;

  INSERT INTO public.pet_care_agreements (pet_id, owner_id, agreement_version, accepted, accepted_at)
  VALUES (v_pet.id, auth.uid(), trim(p_agreement_version), true, now());

  RETURN v_pet;
END;
$$;

CREATE OR REPLACE FUNCTION public.interact_with_troll_pet(
  p_pet_id UUID,
  p_interaction_type TEXT
)
RETURNS public.pets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pet public.pets;
  v_delta INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_interaction_type NOT IN ('feed', 'walk', 'care') THEN RAISE EXCEPTION 'Unsupported pet interaction'; END IF;

  SELECT * INTO v_pet FROM public.pets WHERE id = p_pet_id AND owner_id = auth.uid() AND is_active = true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pet not found'; END IF;

  v_delta := CASE p_interaction_type WHEN 'feed' THEN 8 WHEN 'walk' THEN 7 ELSE 6 END;
  UPDATE public.pets
  SET care_status = LEAST(100, care_status + v_delta),
      needs = jsonb_set(needs, ARRAY[CASE p_interaction_type WHEN 'feed' THEN 'hunger' WHEN 'walk' THEN 'walk' ELSE 'care' END], 'false'::jsonb),
      training_xp = training_xp + 1,
      updated_at = now(),
      last_care_at = now()
  WHERE id = p_pet_id
  RETURNING * INTO v_pet;

  INSERT INTO public.pet_interactions (pet_id, owner_id, interaction_type, status_delta)
  VALUES (p_pet_id, auth.uid(), p_interaction_type, v_delta);

  RETURN v_pet;
END;
$$;

CREATE OR REPLACE FUNCTION public.report_pet_abuse(
  p_pet_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pet public.pets%ROWTYPE;
  v_debit JSONB;
  v_action_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO v_pet FROM public.pets WHERE id = p_pet_id AND is_active = true FOR UPDATE;
  IF NOT FOUND OR v_pet.owner_id = auth.uid() THEN RAISE EXCEPTION 'Invalid pet report'; END IF;
  IF v_pet.care_status >= 80 THEN RAISE EXCEPTION 'Pet status does not qualify for a report'; END IF;

  INSERT INTO public.pet_abuse_actions (pet_id, owner_id, reporter_id, status_at_report)
  VALUES (v_pet.id, v_pet.owner_id, auth.uid(), v_pet.care_status)
  RETURNING id INTO v_action_id;

  SELECT public.troll_bank_spend_coins(
    v_pet.owner_id, 100, 'paid', 'pet_abuse_penalty', v_action_id::text,
    jsonb_build_object('pet_id', v_pet.id, 'reporter_id', auth.uid())
  ) INTO v_debit;

  IF COALESCE((v_debit ->> 'success')::BOOLEAN, false) IS NOT TRUE THEN
    RAISE EXCEPTION '%', COALESCE(v_debit ->> 'error', 'Pet penalty could not be processed');
  END IF;

  UPDATE public.pet_abuse_actions
  SET ledger_id = NULLIF(v_debit ->> 'ledger_id', '')::UUID
  WHERE id = v_action_id;

  RETURN jsonb_build_object('success', true, 'action_id', v_action_id, 'penalty_coins', 100);
END;
$$;

REVOKE ALL ON FUNCTION public.adopt_troll_pet(TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.interact_with_troll_pet(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.report_pet_abuse(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.adopt_troll_pet(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.interact_with_troll_pet(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_pet_abuse(UUID) TO authenticated;