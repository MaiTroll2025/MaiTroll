import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { withCors, handleCorsPreflight } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

export const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return handleCorsPreflight();
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return withCors({ error: 'Missing authorization' }, 401);
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return withCors({ error: 'Invalid user' }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const {
      battle_id,
      sender_id,
      receiver_id,
      gift_id,
      gift_amount,
      stream_id,
      paid_coin_amount,
      free_coin_amount,
    } = body as {
      battle_id?: string;
      sender_id?: string;
      receiver_id?: string;
      gift_id?: string;
      gift_amount?: number;
      stream_id?: string;
      paid_coin_amount?: number;
      free_coin_amount?: number;
    };

    if (!battle_id || !sender_id || !receiver_id || !gift_amount) {
      return withCors({ error: 'battle_id, sender_id, receiver_id, and gift_amount are required' }, 400);
    }

    if (paid_coin_amount === undefined && free_coin_amount === undefined) {
      return withCors({ error: 'paid_coin_amount or free_coin_amount is required' }, 400);
    }

    const { data: battle, error: battleError } = await supabase
      .from('battles')
      .select('id, status, active_event_type, active_event_started_at, active_event_ends_at, timer_rate, gift_locked_host_id')
      .eq('id', battle_id)
      .single();

    if (battleError || !battle) {
      return withCors({ error: 'Battle not found' }, 404);
    }

    if (battle.status !== 'active') {
      return withCors({ error: 'Battle is not active' }, 400);
    }

    const now = new Date();
    const eventActive = battle.active_event_type &&
      battle.active_event_started_at &&
      battle.active_event_ends_at &&
      new Date(battle.active_event_started_at) <= now &&
      now <= new Date(battle.active_event_ends_at);

    if (battle.gift_locked_host_id && battle.gift_locked_host_id === receiver_id) {
      return withCors({ error: 'This host gift vault is locked', locked: true }, 403);
    }

    const totalCoinAmount = (paid_coin_amount || 0) + (free_coin_amount || 0);
    const activeEvent = eventActive ? battle.active_event_type : null;

    let cashoutEligibleAmount = paid_coin_amount || 0;
    let battlePointAmount = paid_coin_amount || 0;
    let eventBonusAmount = 0;
    let multiplier = 1;

    if (activeEvent === 'triple_points') {
      multiplier = 3;
      battlePointAmount = (paid_coin_amount || 0) * 3;
      eventBonusAmount = (paid_coin_amount || 0) * 2;
    } else if (activeEvent === 'glow_mode' && (paid_coin_amount || 0) >= 1000) {
      multiplier = 2;
      eventBonusAmount = (paid_coin_amount || 0) * 2;
      cashoutEligibleAmount = paid_coin_amount || 0;
    }

    const { data: senderProfile, error: senderError } = await supabase
      .from('user_profiles')
      .select('paid_coins, free_coin_balance, troll_coins')
      .eq('id', sender_id)
      .single();

    if (senderError || !senderProfile) {
      return withCors({ error: 'Sender profile not found' }, 404);
    }

    const paidBalance = senderProfile.paid_coins || 0;
    const freeBalance = senderProfile.free_coin_balance || 0;

    let paidDeducted = 0;
    let freeDeducted = 0;

    if (paid_coin_amount && paid_coin_amount > 0) {
      paidDeducted = Math.min(paid_coin_amount, paidBalance);
    }

    const remainingToDeduct = totalCoinAmount - paidDeducted;
    if (remainingToDeduct > 0 && free_coin_amount && free_coin_amount > 0) {
      freeDeducted = Math.min(remainingToDeduct, freeBalance);
    }

    const totalDeducted = paidDeducted + freeDeducted;
    if (totalDeducted < totalCoinAmount) {
      return withCors({ error: 'Insufficient coin balance', required: totalCoinAmount, available: totalDeducted }, 400);
    }

    const { error: updateSenderError } = await supabase
      .from('user_profiles')
      .update({
        paid_coins: paidBalance - paidDeducted,
        free_coin_balance: freeBalance - freeDeducted,
      })
      .eq('id', sender_id);

    if (updateSenderError) {
      return withCors({ error: 'Failed to deduct sender coins' }, 500);
    }

    const { data: receiverProfile, error: receiverError } = await supabase
      .from('user_profiles')
      .select('paid_coins, free_coin_balance')
      .eq('id', receiver_id)
      .single();

    if (receiverError || !receiverProfile) {
      return withCors({ error: 'Receiver profile not found' }, 404);
    }

    const receiverPaidBalance = receiverProfile.paid_coins || 0;
    const receiverFreeBalance = receiverProfile.free_coin_balance || 0;

    const { error: updateReceiverError } = await supabase
      .from('user_profiles')
      .update({
        paid_coins: receiverPaidBalance + cashoutEligibleAmount,
        free_coin_balance: receiverFreeBalance + eventBonusAmount,
      })
      .eq('id', receiver_id);

    if (updateReceiverError) {
      return withCors({ error: 'Failed to credit receiver coins' }, 500);
    }

    const { data: transaction, error: txnError } = await supabase
      .from('coin_transactions')
      .insert({
        user_id: sender_id,
        type: 'gift_sent',
        amount: totalDeducted,
        description: `Gift to ${receiver_id} in battle ${battle_id}`,
        source: 'gift',
        battle_id,
        event_type: activeEvent,
        metadata: {
          receiver_id,
          gift_id,
          stream_id,
          paid_coin_amount: paidDeducted,
          free_coin_amount: freeDeducted,
          cashout_eligible_amount: cashoutEligibleAmount,
          battle_point_amount: battlePointAmount,
          event_bonus_amount: eventBonusAmount,
          active_event: activeEvent,
        },
      })
      .select()
      .single();

    if (txnError) {
      return withCors({ error: txnError.message }, 500);
    }

    const { data: giftRecord, error: giftError } = await supabase
      .from('battle_gifts')
      .insert({
        battle_id,
        sender_id,
        receiver_id,
        gift_id,
        gift_amount: totalDeducted,
        paid_coin_amount: paidDeducted,
        free_coin_amount: freeDeducted,
        cashout_eligible_amount: cashoutEligibleAmount,
        battle_point_amount: battlePointAmount,
        event_bonus_amount: eventBonusAmount,
        active_event: activeEvent,
        stream_id,
      })
      .select()
      .single();

    if (giftError) {
      return withCors({ error: giftError.message }, 500);
    }

    const { data: scoreUpdate, error: scoreError } = await supabase
      .from('battles')
      .update({
        score_challenger: battle.active_event_type === 'triple_points'
          ? (battle.score_challenger || 0) + battlePointAmount
          : (battle.score_challenger || 0) + battlePointAmount,
      })
      .eq('id', battle_id)
      .select()
      .single();

    return withCors({
      success: true,
      transaction,
      gift: giftRecord,
      battle_id,
      active_event: activeEvent,
      paid_coin_amount: paidDeducted,
      free_coin_amount: freeDeducted,
      cashout_eligible_amount: cashoutEligibleAmount,
      battle_point_amount: battlePointAmount,
      event_bonus_amount: eventBonusAmount,
    }, 200);
  } catch (e) {
    console.error('process-battle-gift error:', e);
    return withCors({ error: 'Internal error' }, 500);
  }
};

Deno.serve(handler);