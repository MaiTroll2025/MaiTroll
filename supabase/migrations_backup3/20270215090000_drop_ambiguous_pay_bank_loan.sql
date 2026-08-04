-- Drop the integer version of pay_bank_loan to resolve ambiguity with the bigint version
DROP FUNCTION IF EXISTS public.pay_bank_loan(uuid, integer);
