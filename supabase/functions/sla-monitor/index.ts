// ============================================================================
// sla-monitor — Edge Function for SLA (Service Level Agreement) monitoring
// ============================================================================
// Monitors active streams for SLA compliance:
// - Tracks stream uptime, quality (bitrate/fps/resolution), latency
// - Records SLA metric samples via the record_sla_metric_sample RPC
// - Detects SLA violations (uptime breaches, quality degradation, latency spikes)
// - Calculates and queues compensation coins for breached SLAs
// - Can be invoked via POST or scheduled via cron
// ============================================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { withCors, handleCorsPreflight } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function getSupabaseClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

interface StreamHealthSample {
  streamId: string;
  bitrateKbps: number | null;
  fps: number | null;
  resolution: string | null;
  latencyMs: number | null;
  viewerCount: number | null;
  isActive: boolean;
}

interface SlaConfig {
  defaultSlaTier: string;
  goldUptimeThreshold: number;
  platinumUptimeThreshold: number;
  uptimeGracePeriodSecs: number;
  qualityCheckIntervalSecs: number;
  violationCompensationRate: number;
  maxCompensationCoins: number;
  subscriberUptimeBonusPct: number;
  subscriberCompensationMultiplier: number;
}

async function loadSlaConfig(
  supabase: ReturnType<typeof getSupabaseClient>,
): Promise<SlaConfig> {
  const { data, error } = await supabase
    .from("sla_config")
    .select("config_key, config_value, config_type");

  if (error || !data) {
    console.warn("[sla-monitor] Failed to load SLA config, using defaults:", error);
    return {
      defaultSlaTier: "none",
      goldUptimeThreshold: 99.9,
      platinumUptimeThreshold: 99.95,
      uptimeGracePeriodSecs: 120,
      qualityCheckIntervalSecs: 30,
      violationCompensationRate: 0.1,
      maxCompensationCoins: 5000,
      subscriberUptimeBonusPct: 50,
      subscriberCompensationMultiplier: 2,
    };
  }

  const map: Record<string, string> = {};
  for (const row of data as Array<{ config_key: string; config_value: string }>) {
    map[row.config_key] = row.config_value;
  }

  return {
    defaultSlaTier: map.default_sla_tier ?? "none",
    goldUptimeThreshold: Number(map.gold_uptime_threshold_pct ?? "99.9"),
    platinumUptimeThreshold: Number(map.platinum_uptime_threshold_pct ?? "99.95"),
    uptimeGracePeriodSecs: Number(map.sla_uptime_grace_period_secs ?? "120"),
    qualityCheckIntervalSecs: Number(map.sla_quality_check_interval_secs ?? "30"),
    violationCompensationRate: Number(map.sla_violation_compensation_rate ?? "0.1"),
    maxCompensationCoins: Number(map.sla_max_compensation_coins ?? "5000"),
    subscriberUptimeBonusPct: Number(map.sla_subscriber_uptime_bonus_pct ?? "50"),
    subscriberCompensationMultiplier: Number(
      map.sla_subscriber_compensation_multiplier ?? "2",
    ),
  };
}

async function getActiveStreamsWithSla(
  supabase: ReturnType<typeof getSupabaseClient>,
): Promise<
  Array<{
    id: string;
    broadcaster_id: string;
    title: string;
    is_live: boolean;
    started_at: string;
    sla_tier: string;
    sla_target_uptime_pct: number | null;
    sla_started_at: string | null;
    sla_quality_guarantee: string | null;
    sla_min_bitrate_kbps: number | null;
    sla_max_latency_ms: number | null;
    current_viewers: number;
    viewer_count: number;
    agora_channel: string | null;
  }>
> {
  const { data, error } = await supabase
    .from("streams")
    .select(
      `
      id,
      broadcaster_id,
      title,
      is_live,
      started_at,
      sla_tier,
      sla_target_uptime_pct,
      sla_started_at,
      sla_quality_guarantee,
      sla_min_bitrate_kbps,
      sla_max_latency_ms,
      current_viewers,
      viewer_count,
      agora_channel
    `,
    )
    .eq("is_live", true)
    .not("broadcaster_id", "is", null);

  if (error) {
    console.error("[sla-monitor] Error fetching active streams:", error);
    return [];
  }

  return (data || []) as any[];
}

async function getBroadcasterSlaTier(
  supabase: ReturnType<typeof getSupabaseClient>,
  broadcasterId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("sla_tier, level, troll_coins, total_subscriber_revenue_coins, monthly_subscriber_count")
    .eq("id", broadcasterId)
    .maybeSingle();

  if (error || !data) {
    console.error("[sla-monitor] Error fetching broadcaster profile:", error);
    return "none";
  }

  return data.sla_tier || "none";
}

async function determineSlaTier(
  supabase: ReturnType<typeof getSupabaseClient>,
  broadcasterId: string,
  avgUptime: number,
  streamCount: number,
  activeSubCount: number,
): Promise<string> {
  if (avgUptime >= 99.95) return "platinum";
  if (avgUptime >= 99.9 && streamCount >= 5 && activeSubCount >= 10) return "gold";
  if (avgUptime >= 99.0 && streamCount >= 3 && activeSubCount >= 3) return "silver";
  if (avgUptime >= 95.0) return "bronze";
  return "none";
}

async function checkStreamHealth(
  streamId: string,
  channel: string | null,
): Promise<StreamHealthSample> {
  const channelName = channel ?? `gaming_${streamId}`;

  // In a real deployment, this would query Agora/LiveKit API for actual stream health.
  // For now, we simulate by returning known-good values. In production, replace with
  // actual API calls to check bitrate, FPS, resolution, and latency.
  try {
    const res = await fetch(
      `https://api.maitroll.com/internal/stream-health/${encodeURIComponent(streamId)}`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${Deno.env.get("INTERNAL_API_KEY") ?? ""}`,
          "X-Request-ID": crypto.randomUUID(),
          "Content-Type": "application/json",
        },
      },
    );

    if (res.ok) {
      const data = await res.json().catch(() => null) as Record<string, unknown> | null;
      if (data) {
        return {
          streamId,
          bitrateKbps: data.bitrareKbps ?? data.bitrate_kbps ?? null,
          fps: data.fps ?? null,
          resolution: data.resolution ?? null,
          latencyMs: data.latency_ms ?? null,
          viewerCount: data.viewers ?? data.viewerCount ?? null,
          isActive: data.is_active ?? data.isActive ?? true,
        };
      }
    }
  } catch (err) {
    console.warn(
      `[sla-monitor] Stream health check failed for ${streamId}, using fallback:`,
      err,
    );
  }

  return {
    streamId,
    bitrateKbps: null,
    fps: null,
    resolution: null,
    latencyMs: null,
    viewerCount: null,
    isActive: true,
  };
}

async function recordSlaMetricSample(
  supabase: ReturnType<typeof getSupabaseClient>,
  streamId: string,
  sampleType: string,
  value: number,
  detail: Record<string, unknown>,
) {
  const { data, error } = await supabase.rpc("record_sla_metric_sample", {
    p_stream_id: streamId,
    p_sample_type: sampleType,
    p_value: value,
    p_detail: JSON.stringify(detail),
  });

  if (error) {
    console.error(
      `[sla-monitor] Failed to record ${sampleType} sample for stream ${streamId}:`,
      error,
    );
  }
  return data;
}

async function checkAndRecordViolation(
  supabase: ReturnType<typeof getSupabaseClient>,
  stream: {
    id: string;
    broadcaster_id: string;
    sla_tier: string;
    sla_target_uptime_pct: number | null;
    sla_quality_guarantee: string | null;
    sla_min_bitrate_kbps: number | null;
    sla_max_latency_ms: number | null;
  },
  sample: StreamHealthSample,
  config: SlaConfig,
  uptimePct: number,
): Promise<void> {
  // Check uptime violation
  const targetUptime = stream.sla_target_uptime_pct ?? 99.0;
  if (uptimePct < targetUptime) {
    const compensationRate = config.violationCompensationRate;
    await supabase.from("sla_violations").insert({
      stream_id: stream.id,
      broadcaster_id: stream.broadcaster_id,
      violation_type: "uptime_breach",
      tier_at_time: stream.sla_tier,
      actual_value: JSON.stringify({
        actual_uptime_pct: uptimePct,
        target_uptime_pct: targetUptime,
      }),
      expected_value: JSON.stringify({ target_uptime_pct: targetUptime }),
      compensation_coins: 0, // Calculated and issued separately
      notes:
        `Stream uptime ${uptimePct}% below SLA target ${targetUptime}% ` +
        `(tier: ${stream.sla_tier || "none"})`,
    });
    console.warn(
      `[sla-monitor] Uptime SLA violation for stream ${stream.id}: ${uptimePct}% < ${targetUptime}%`,
    );
  }

  // Check quality degradation (bitrate below guarantee)
  if (
    sample.bitrateKbps !== null &&
    stream.sla_min_bitrate_kbps !== null &&
    stream.sla_min_bitrate_kbps > 0 &&
    sample.bitrateKbps < stream.sla_min_bitrate_kbps
  ) {
    await supabase.from("sla_violations").insert({
      stream_id: stream.id,
      broadcaster_id: stream.broadcaster_id,
      violation_type: "quality_degradation",
      tier_at_time: stream.sla_tier,
      actual_value: JSON.stringify({
        actual_bitrate_kbps: sample.bitrateKbps,
        min_bitrate_kbps: stream.sla_min_bitrate_kbps,
      }),
      expected_value: JSON.stringify({ min_bitrate_kbps: stream.sla_min_bitrate_kbps }),
      compensation_coins: 0,
      notes:
        `Stream bitrate ${sample.bitrateKbps}kbps below SLA minimum ${stream.sla_min_bitrate_kbps}kbps`,
    });
    console.warn(
      `[sla-monitor] Quality SLA violation for stream ${stream.id}: bitrate ${sample.bitrateKbps}kbps below ${stream.sla_min_bitrate_kbps}kbps`,
    );
  }

  // Check latency spike
  if (
    sample.latencyMs !== null &&
    stream.sla_max_latency_ms !== null &&
    stream.sla_max_latency_ms > 0 &&
    sample.latencyMs > stream.sla_max_latency_ms
  ) {
    await supabase.from("sla_violations").insert({
      stream_id: stream.id,
      broadcaster_id: stream.broadcaster_id,
      violation_type: "latency_spike",
      tier_at_time: stream.sla_tier,
      actual_value: JSON.stringify({
        actual_latency_ms: sample.latencyMs,
        max_latency_ms: stream.sla_max_latency_ms,
      }),
      expected_value: JSON.stringify({ max_latency_ms: stream.sla_max_latency_ms }),
      compensation_coins: 0,
      notes:
        `Stream latency ${sample.latencyMs}ms above SLA max ${stream.sla_max_latency_ms}ms`,
    });
    console.warn(
      `[sla-monitor] Latency SLA violation for stream ${stream.id}: ${sample.latencyMs}ms > ${stream.sla_max_latency_ms}ms`,
    );
  }
}

async function updateStreamSla(
  supabase: ReturnType<typeof getSupabaseClient>,
  streamId: string,
  updates: Record<string, unknown>,
) {
  const { error } = await supabase
    .from("streams")
    .update(updates)
    .eq("id", streamId);

  if (error) {
    console.error(
      `[sla-monitor] Failed to update SLA fields for stream ${streamId}:`,
      error,
    );
  }
}

async function checkSubscriberSla(
  supabase: ReturnType<typeof getSupabaseClient>,
  broadcasterId: string,
): Promise<void> {
  // Check subscriptions for SLA violations (e.g., subscriber features not delivered)
  const { data: subscriptions, error: subsError } = await supabase
    .from("user_subscriptions")
    .select(
      `id, subscriber_id, tier:subscription_tiers (id, name, sla_chat_priority, sla_quality_guarantee, sla_uptime_guarantee_pct)`,
    )
    .eq("broadcaster_id", broadcasterId)
    .eq("is_active", true);

  if (subsError || !subscriptions) {
    console.error(
      `[sla-monitor] Error fetching subscriptions for ${broadcasterId}:`,
      subsError,
    );
    return;
  }

  for (const sub of subscriptions as Array<any>) {
    const tier = sub.tier;
    if (!tier) continue;

    // Check if this subscriber has priority chat access but it's not enabled
    if (tier.sla_chat_priority === "priority" || tier.sla_chat_priority === "vip_only") {
      if (!sub.sla_priority_chat) {
        // Subscriber is not getting their guaranteed priority chat
        await supabase.from("sla_violations").insert({
          stream_id: null,
          broadcaster_id: broadcasterId,
          subscription_id: sub.id,
          violation_type: "subscriber_feature_missing",
          tier_at_time: tier.name,
          actual_value: JSON.stringify({
            feature: "priority_chat",
            expected: tier.sla_chat_priority,
            actual: "not_enabled",
          }),
          expected_value: JSON.stringify({
            feature: "priority_chat",
            expected: tier.sla_chat_priority,
          }),
          compensation_coins: 0,
          notes:
            `Subscriber (sub: ${sub.id}) not receiving guaranteed priority chat (${tier.sla_chat_priority})`,
        });
        console.warn(
          `[sla-monitor] Subscriber SLA violation: priority chat not active for sub ${sub.id}`,
        );
      }
    }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCorsPreflight(req);
  }

  try {
    if (req.method !== "POST") {
      return withCors(
        { error: "Method not allowed" },
        405,
        req,
      );
    }

    const body = await req.json().catch(() => ({}));
    const action: string = body?.action || "monitor";
    const supabase = getSupabaseClient();

    // Load SLA configuration
    const config = await loadSlaConfig(supabase);

    // ------------------------------------------------------------------
    // Action: "monitor" — Full SLA monitoring sweep of all active streams
    // ------------------------------------------------------------------
    if (action === "monitor" || action === "run") {
      const activeStreams = await getActiveStreamsWithSla(supabase);

      if (activeStreams.length === 0) {
        return withCors(
          {
            ok: true,
            message: "No active streams to monitor",
            streamsChecked: 0,
            violationsDetected: 0,
          },
          200,
          req,
        );
      }

      let violationsDetected = 0;
      const streamResults: Array<Record<string, unknown>> = [];

      for (const stream of activeStreams) {
        if (!stream.is_live) continue;

        // Determine SLA tier for this stream
        let slaTier = stream.sla_tier || "none";

        // If stream SLA tier is none, check broadcaster's profile
        if (slaTier === "none") {
          const broadcasterSlaTier = await getBroadcasterSlaTier(
            supabase,
            stream.broadcaster_id,
          );
          if (broadcasterSlaTier !== "none") {
            slaTier = broadcasterSlaTier;
          }
        }

        // Check stream health (bitrate, FPS, resolution, latency)
        const healthSample = await checkStreamHealth(stream.id, stream.agora_channel);

        // Calculate uptime percentage
        let uptimePct = 100.0;
        if (stream.sla_started_at && stream.sla_uptime_seconds !== undefined) {
          const elapsed = Math.floor(
            (Date.now() - new Date(stream.sla_started_at).getTime()) / 1000,
          );
          const uptimeSecs = stream.sla_uptime_seconds;
          if (elapsed > 0) {
            uptimePct = Math.max(
              0,
              Math.min(100, (uptimeSecs / elapsed) * 100),
            );
          }
        }

        // Record samples
        if (healthSample.bitrateKbps !== null) {
          await recordSlaMetricSample(
            supabase,
            stream.id,
            "bitrate",
            healthSample.bitrateKbps,
            { streamId: stream.id, isActive: healthSample.isActive },
          );
        }

        if (healthSample.latencyMs !== null) {
          await recordSlaMetricSample(
            supabase,
            stream.id,
            "latency",
            healthSample.latencyMs,
            { streamId: stream.id, isActive: healthSample.isActive },
          );
        }

        // Check for violations
        const violationsBefore = violationsDetected;
        await checkAndRecordViolation(
          supabase,
          stream,
          healthSample,
          config,
          uptimePct,
        );

        // Count violations for this stream
        const { count: violationCount } = await supabase
          .from("sla_violations")
          .select("*", { count: "exact", head: true })
          .eq("stream_id", stream.id)
          .eq("resolved", false);

        violationsDetected += violationCount || 0;

        // Update stream SLA fields
        await updateStreamSla(supabase, stream.id, {
          sla_tier: slaTier,
          sla_actual_uptime_pct: Math.round(uptimePct * 100) / 100,
          sla_last_quality_check_at: new Date().toISOString(),
          current_viewers: healthSample.viewerCount ?? stream.current_viewers,
        });

        // Check subscriber SLAs for this broadcaster
        await checkSubscriberSla(supabase, stream.broadcaster_id);

        streamResults.push({
          streamId: stream.id,
          broadcasterId: stream.broadcaster_id,
          title: stream.title,
          slaTier,
          uptimePct: Math.round(uptimePct * 100) / 100,
          targetUptime: stream.sla_target_uptime_pct ?? 99.0,
          violations: violationCount || 0,
          sample: {
            bitrateKbps: healthSample.bitrateKbps,
            fps: healthSample.fps,
            resolution: healthSample.resolution,
            latencyMs: healthSample.latencyMs,
            viewers: healthSample.viewerCount,
          },
        });

        if (violationsBefore > 0 && (violationsDetected - violationsBefore) > 0) {
          console.warn(
            `[sla-monitor] Detected ${violationsDetected - violationsBefore} new violations for stream ${stream.id}`,
          );
        }
      }

      return withCors(
        {
          ok: true,
          message: "SLA monitoring sweep complete",
          streamsChecked: activeStreams.length,
          violationsDetected,
          streams: streamResults,
        },
        200,
        req,
      );
    }

    // ------------------------------------------------------------------
    // Action: "check" — Check SLA status for a single stream
    // ------------------------------------------------------------------
    if (action === "check") {
      const streamId: string = body?.streamId;

      if (!streamId) {
        return withCors(
          { error: "Missing streamId" },
          400,
          req,
        );
      }

      const { data: streamData, error: streamError } = await supabase.rpc(
        "get_stream_sla_status",
        { p_stream_id: streamId },
      );

      if (streamError) {
        return withCors(
          { error: "Failed to fetch SLA status", details: streamError.message },
          400,
          req,
        );
      }

      const stream = streamData?.[0] || streamData;

      const { data: metrics, error: metricsError } = await supabase
        .from("sla_metrics")
        .select("*")
        .eq("stream_id", streamId)
        .order("created_at", { ascending: false })
        .limit(10);

      const { data: violations, error: violationsError } = await supabase
        .from("sla_violations")
        .select("*")
        .eq("stream_id", streamId)
        .order("created_at", { ascending: false })
        .limit(20);

      return withCors(
        {
          ok: true,
          streamId,
          slaStatus: stream,
          recentMetrics: metrics || [],
          recentViolations: violations || [],
        },
        200,
        req,
      );
    }

    // ------------------------------------------------------------------
    // Action: "subscription" — Check SLA status for a subscription
    // ------------------------------------------------------------------
    if (action === "subscription") {
      const subscriptionId: string = body?.subscriptionId;

      if (!subscriptionId) {
        return withCors(
          { error: "Missing subscriptionId" },
          400,
          req,
        );
      }

      const { data, error } = await supabase.rpc("get_subscription_sla_status", {
        p_subscription_id: subscriptionId,
      });

      if (error) {
        return withCors(
          { error: "Failed to fetch subscription SLA status", details: error.message },
          400,
          req,
        );
      }

      return withCors(
        { ok: true, subscriptionId, slaStatus: data?.[0] || data },
        200,
        req,
      );
    }

    // ------------------------------------------------------------------
    // Action: "broadcaster" — Get SLA summary for a broadcaster
    // ------------------------------------------------------------------
    if (action === "broadcaster") {
      const broadcasterId: string = body?.broadcasterId || body?.userId;

      if (!broadcasterId) {
        return withCors(
          { error: "Missing broadcasterId" },
          400,
          req,
        );
      }

      const summary = await supabase.rpc("get_broadcaster_sla_summary", {
        p_broadcaster_id: broadcasterId,
      });

      const violations = await supabase.rpc("get_broadcaster_sla_violations", {
        p_broadcaster_id: broadcasterId,
      });

      return withCors(
        {
          ok: true,
          broadcasterId,
          slaSummary: summary.data?.[0] || summary.data,
          violations: violations.data || [],
        },
        200,
        req,
      );
    }

    // ------------------------------------------------------------------
    // Action: "claim" — Claim SLA compensation for a violation
    // ------------------------------------------------------------------
    if (action === "claim") {
      const violationId: string = body?.violationId;

      if (!violationId) {
        return withCors(
          { error: "Missing violationId" },
          400,
          req,
        );
      }

      const { data, error } = await supabase.rpc("claim_sla_compensation", {
        p_violation_id: violationId,
      });

      if (error) {
        return withCors(
          { error: "Failed to claim compensation", details: error.message },
          400,
          req,
        );
      }

      return withCors(
        { ok: true, result: data?.[0] || data },
        200,
        req,
      );
    }

    // ------------------------------------------------------------------
    // Action: "sample" — Record a single SLA metric sample for a stream
    // ------------------------------------------------------------------
    if (action === "sample") {
      const streamId: string = body?.streamId;
      const sampleType: string = body?.sampleType;
      const value: number = body?.value;
      const detail: Record<string, unknown> = body?.detail || {};

      if (!streamId || !sampleType || value === undefined) {
        return withCors(
          { error: "Missing streamId, sampleType, or value" },
          400,
          req,
        );
      }

      await recordSlaMetricSample(supabase, streamId, sampleType, value, detail);

      return withCors(
        { ok: true, message: `Recorded ${sampleType} sample for stream ${streamId}` },
        200,
        req,
      );
    }

    return withCors(
      { error: `Unknown action: ${action}` },
      400,
      req,
    );
  } catch (err) {
    console.error("[sla-monitor] Error:", err);
    return withCors(
      {
        error: err instanceof Error ? err.message : "Unknown error",
      },
      500,
      req,
    );
  }
});
