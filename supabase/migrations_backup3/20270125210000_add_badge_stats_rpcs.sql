-- Gift Stats
create or replace function get_gift_stats(p_user_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_total_gifts int;
  v_total_amount numeric;
  v_unique_recipients int;
begin
  select count(*), coalesce(sum(coins_spent), 0), count(distinct recipient_id)
  into v_total_gifts, v_total_amount, v_unique_recipients
  from gift_sends
  where sender_id = p_user_id;

  return jsonb_build_object(
    'total_gifts', v_total_gifts,
    'total_gift_amount', v_total_amount,
    'unique_recipients', v_unique_recipients
  );
end;
$$;

-- Loan Stats
create or replace function get_loan_stats(p_user_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_on_time_payments int;
  v_loans_paid_off int;
begin
  select count(*) into v_on_time_payments
  from credit_events
  where user_id = p_user_id and event_type = 'loan_on_time_payment';

  select count(*) into v_loans_paid_off
  from credit_events
  where user_id = p_user_id and event_type = 'loan_full_payoff';

  return jsonb_build_object(
    'on_time_payments', v_on_time_payments,
    'loans_paid_off', v_loans_paid_off,
    'loan_repaid_count', v_loans_paid_off, 
    'paid_off', v_loans_paid_off > 0
  );
end;
$$;
