-- Store the Hytro Gaming loan choice and requested amount on agency applications.
ALTER TABLE public.agency_applications
  ADD COLUMN IF NOT EXISTS apply_for_loan boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS loan_amount numeric(12, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.agency_applications.apply_for_loan IS
  'Whether the Hytro Gaming agency application requests startup-fee loan assistance.';

COMMENT ON COLUMN public.agency_applications.loan_amount IS
  'Requested Troll Coin amount for Hytro Gaming agency startup-fee loan assistance.';
