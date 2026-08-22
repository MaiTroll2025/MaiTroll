// ============================================================================
// sla-monitor — Edge Function for SLA (Service Level Agreement) monitoring
// ============================================================================
// Monitors active streams for SLA compliance:
// - Tracks stream uptime, quality (bitrate/fps/resolution), latency
// - Records SLA metric samples via the record_sla_metric_sample RPC
// - Detects SLA violations (uptime breaches, quality degradation, latency spikes)
// - Calculates and queues compensation coins for breached SLAs
// - Can be invoked via POST or scheduled via cron
//
// Request contract (POST JSON body):
//   action: "monitor" | "run" | "check" | "subscription" | "broadcaster" | "claim" | "sample"
//
// Required params per action:
//   monitor / run   : none
//   check           : streamId (string)
//   subscription    : subscriptionId (string)
//   broadcaster     : broadcasterId (string)
//   claim           : violationId (string)
//   sample          : streamId (string), sampleType (string), value (number), detail? (object)
//
// Response: always JSON with CORS headers
//   ok: boolean
//   error?: string (client-facing)
//   details?: string (server-side details, only on 5xx)
// ============================================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { withCors, handleCorsPreflight } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function getSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

// ============================================================================
// Explicit request / response types
// ============================================================================

type _Action =
  | "monitor"
  | "run"
  | "check"
  | "subscription"
  | "broadcaster"
  | "claim"
  | "sample";

interface MonitorRequest {
  action: "monitor" | "run";
}

interface CheckRequest {
  action: "check";
  streamId: string;
}

interface SubscriptionRequest {
  action: "subscription";
  subscriptionId: string;
}

interface BroadcasterRequest {
  action: "broadcaster";
  broadcasterId: string;
}

interface ClaimRequest {
  action: "claim";
  violationId: string;
}

interface SampleRequest {
  action: "sample";
  streamId: string;
  sampleType: string;
  value: number;
  detail?: Record<string, unknown>;
}

type SlaMonitorRequest =
  | MonitorRequest
  | CheckRequest
  | SubscriptionRequest
  | BroadcasterRequest
  | ClaimRequest
  | SampleRequest;

// ============================================================================
// Validation
// ============================================================================

function validateRequest(body: unknown): SlaMonitorRequest {
  if (typeof body !== "object" || body === null) {
    throw new Error("Request body must be a JSON object");
  }

  const { action, ...rest } = body as Record<string, unknown>;

  if (!action || typeof action !== "string") {
    throw new Error("Missing or invalid action");
  }

  switch (action) {
    case "monitor":
    case "run":
      return { action: "monitor" } as MonitorRequest;

    case "check": {
      const streamId = rest.streamId;
      if (!streamId || typeof streamId !== "string" || streamId.trim() === "") {
        throw new Error("Missing or invalid streamId");
      }
      return { action: "check", streamId: streamId.trim() } as CheckRequest;
    }

    case "subscription": {
      const subscriptionId = rest.subscriptionId;
      if (!subscriptionId || typeof subscriptionId !== "string" || subscriptionId.trim() === "") {
        throw new Error("Missing or invalid subscriptionId");
      }
      return { action: "subscription", subscriptionId: subscriptionId.trim() } as SubscriptionRequest;
    }

    case "broadcaster": {
      const broadcasterId = rest.broadcasterId || rest.userId;
      if (!broadcasterId || typeof broadcasterId !== "string" || broadcasterId.trim() === "") {
        throw new Error("Missing or invalid broadcasterId");
      }
      return { action: "broadcaster", broadcasterId: broadcasterId.trim() } as BroadcasterRequest;
    }

    case "claim": {
      const violationId = rest.violationId;
      if (!violationId || typeof violationId !== "string" || violationId.trim() === "") {
        throw new Error("Missing or invalid violationId");
      }
      return { action: "claim", violationId: violationId.trim() } as ClaimRequest;
    }

    case "sample": {
      const streamId = rest.streamId;
      const sampleType = rest.sampleType;
      const value = rest.value;
      if (!streamId || typeof streamId !== "string" || streamId.trim() === "") {
        throw new Error("Missing or invalid streamId");
      }
      if (!sampleType || typeof sampleType !== "string" || sampleType.trim() === "") {
        throw new Error("Missing or invalid sampleType");
      }
      if (typeof value !== "number") {
        throw new Error("Missing or invalid value");
      }
      return {
        action: "sample",
        streamId: streamId.trim(),
        sampleType: sampleType.trim(),
        value,
        detail: (rest.detail as Record<string, unknown>) || {},
      } as SampleRequest;
    }

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

// ============================================================================
// SLA config
// ============================================================================

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

const DEFAULT_SLA_CONFIG: SlaConfig = {
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

async function loadSlaConfig(
  supabase: ReturnType<typeof getSupabaseClient>,
): Promise<SlaConfig> {
  const { data, error } = await supabase
    .from("sla_config")
    .select("config_key, config_value, config_type");

  if (error || !data) {
    console.warn("[sla-monitor] Failed to load SLA config, using defaults:", error);
    return DEFAULT_SLA_CONFIG;
  }

  const map: Record<string, string> = {};
  for (const row of data as Array<{ config_key: string; config_value: string }>) {
    map[row.config_key] = row.config_value;
  }

  return {
    defaultSlaTier: map.default_sla_tier ?? DEFAULT_SLA_CONFIG.defaultSlaTier,
    goldUptimeThreshold: Number(map.gold_uptime_threshold_pct ?? DEFAULT_SLA_CONFIG.goldUptimeThreshold),
    platinumUptimeThreshold: Number(map.platinum_uptime_threshold_pct ?? DEFAULT_SLA_CONFIG.platinumUptimeThreshold),
    uptimeGracePeriodSecs: Number(map.sla_uptime_grace_period_secs ?? DEFAULT_SLA_CONFIG.uptimeGracePeriodSecs),
    qualityCheckIntervalSecs: Number(map.sla_quality_check_interval_secs ?? DEFAULT_SLA_CONFIG.qualityCheckIntervalSecs),
    violationCompensationRate: Number(map.sla_violation_compensation_rate ?? DEFAULT_SLA_CONFIG.violationCompensationRate),
    maxCompensationCoins: Number(map.sla_max_compensation_coins ?? DEFAULT_SLA_CONFIG.maxCompensationCoins),
    subscriberUptimeBonusPct: Number(map.sla_subscriber_uptime_bonus_pct ?? DEFAULT_SLA_CONFIG.subscriberUptimeBonusPct),
    subscriberCompensationMultiplier: Number(
      map.sla_subscriber_compensation_multiplier ?? DEFAULT_SLA_CONFIG.subscriberCompensationMultiplier,
    ),
  };
}

// ============================================================================
// Stream health (MaiTroll / LiveKit architecture)
// ============================================================================

interface StreamHealthSample {
  streamId: string;
  bitrateKbps: number | null;
  fps: number | null;
  resolution: string | null;
  latencyMs: number | null;
  viewerCount: number | null;
  isActive: boolean;
}

async function checkStreamHealth(
  streamId: string,
  channel: string | null,
): Promise<StreamHealthSample> {
  const _channelName = channel ?? `gaming_${streamId}`;
  (void _channelName);

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

// ============================================================================
// DB helpers
// ============================================================================

interface ActiveStream {
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
  sla_uptime_seconds: number | null;
  sla_downtime_seconds: number | null;
  current_viewers: number;
  viewer_count: number;
  agora_channel: string | null;
}

async function getActiveStreamsWithSla(
  supabase: ReturnType<typeof getSupabaseClient>,
): Promise<ActiveStream[]> {
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
      sla_uptime_seconds,
      sla_downtime_seconds,
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

  return (data || []) as ActiveStream[];
}

async function getBroadcasterSlaTier(
  supabase: ReturnType<typeof getSupabaseClient>,
  broadcasterId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("sla_tier")
    .eq("id", broadcasterId)
    .maybeSingle();

  if (error || !data) {
    console.error("[sla-monitor] Error fetching broadcaster profile:", error);
    return "none";
  }

  return data.sla_tier || "none";
}

async function recordSlaMetricSample(
  supabase: ReturnType<typeof getSupabaseClient>,
  streamId: string,
  sampleType: string,
  value: number,
  detail: Record<string, unknown>,
) {
  const { error } = await supabase.rpc("record_sla_metric_sample", {
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
}

async function checkAndRecordViolation(
  supabase: ReturnType<typeof getSupabaseClient>,
  stream: {
    id: string;
    broadcaster_id: string;
    sla_tier: string;
    sla_target_uptime_pct: number | null;
    sla_min_bitrate_kbps: number | null;
    sla_max_latency_ms: number | null;
  },
  sample: StreamHealthSample,
  config: SlaConfig,
  uptimePct: number,
): Promise<void> {
  const targetUptime = stream.sla_target_uptime_pct ?? 99.0;
  if (uptimePct < targetUptime) {
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
      compensation_coins: 0,
      notes:
        `Stream uptime ${uptimePct}% below SLA target ${targetUptime}% ` +
        `(tier: ${stream.sla_tier || "none"})`,
    });
    console.warn(
      `[sla-monitor] Uptime SLA violation for stream ${stream.id}: ${uptimePct}% < ${targetUptime}%`,
    );
  }

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

    if (tier.sla_chat_priority === "priority" || tier.sla_chat_priority === "vip_only") {
      if (!sub.sla_priority_chat) {
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

// ============================================================================
// Action handlers
// ============================================================================

async function handleMonitor(
  req: Request,
  supabase: ReturnType<typeof getSupabaseClient>,
): Promise<Response> {
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

  const config = await loadSlaConfig(supabase);
  let violationsDetected = 0;
  const streamResults: Array<Record<string, unknown>> = [];

  for (const stream of activeStreams) {
    if (!stream.is_live) continue;

    let slaTier = stream.sla_tier || "none";

    if (slaTier === "none") {
      const broadcasterSlaTier = await getBroadcasterSlaTier(
        supabase,
        stream.broadcaster_id,
      );
      if (broadcasterSlaTier !== "none") {
        slaTier = broadcasterSlaTier;
      }
    }

    const healthSample = await checkStreamHealth(stream.id, stream.agora_channel);

    let uptimePct = 100.0;
    let elapsed = 0;
    if (stream.sla_started_at) {
      elapsed = Math.floor(
        (Date.now() - new Date(stream.sla_started_at).getTime()) / 1000,
      );
      const downtimeSecs = stream.sla_downtime_seconds || 0;
      const uptimeSecs = Math.max(0, elapsed - downtimeSecs);
      if (elapsed > 0) {
        uptimePct = Math.max(
          0,
          Math.min(100, (uptimeSecs / elapsed) * 100),
        );
      }
    }

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

    await checkAndRecordViolation(
      supabase,
      stream,
      healthSample,
      config,
      uptimePct,
    );

    const { count: violationCount } = await supabase
      .from("sla_violations")
      .select("*", { count: "exact", head: true })
      .eq("stream_id", stream.id)
      .eq("resolved", false);

    violationsDetected += violationCount || 0;

    await updateStreamSla(supabase, stream.id, {
      sla_tier: slaTier,
      sla_uptime_seconds: Math.max(0, elapsed - (stream.sla_downtime_seconds || 0)),
      sla_actual_uptime_pct: Math.round(uptimePct * 100) / 100,
      sla_last_quality_check_at: new Date().toISOString(),
      current_viewers: healthSample.viewerCount ?? stream.current_viewers,
    });

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

async function handleCheck(
  req: Request,
  supabase: ReturnType<typeof getSupabaseClient>,
  params: { streamId: string },
): Promise<Response> {
  const { streamId } = params;

  const { data: streamData, error: streamError } = await supabase.rpc(
    "get_stream_sla_status",
    { p_stream_id: streamId },
  );

  if (streamError) {
    console.error("[sla-monitor] RPC get_stream_sla_status error:", streamError);
    return withCors(
      {
        ok: false,
        error: "Failed to fetch SLA status",
        details: process.env.NODE_ENV === "development" ? streamError.message : undefined,
      },
      200,
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

  if (metricsError) {
    console.error("[sla-monitor] Error fetching metrics:", metricsError);
  }

  const { data: violations, error: violationsError } = await supabase
    .from("sla_violations")
    .select("*")
    .eq("stream_id", streamId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (violationsError) {
    console.error("[sla-monitor] Error fetching violations:", violationsError);
  }

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

async function handleSubscription(
  req: Request,
  supabase: ReturnType<typeof getSupabaseClient>,
  params: { subscriptionId: string },
): Promise<Response> {
  const { subscriptionId } = params;

  const { data, error } = await supabase.rpc("get_subscription_sla_status", {
    p_subscription_id: subscriptionId,
  });

  if (error) {
    console.error("[sla-monitor] RPC get_subscription_sla_status error:", error);
    return withCors(
      {
        error: "Failed to fetch subscription SLA status",
        details: process.env.NODE_ENV === "development" ? error.message : undefined,
      },
      500,
      req,
    );
  }

  return withCors(
    { ok: true, subscriptionId, slaStatus: data?.[0] || data },
    200,
    req,
  );
}

async function handleBroadcaster(
  req: Request,
  supabase: ReturnType<typeof getSupabaseClient>,
  params: { broadcasterId: string },
): Promise<Response> {
  const { broadcasterId } = params;

  const summary = await supabase.rpc("get_broadcaster_sla_summary", {
    p_broadcaster_id: broadcasterId,
  });

  if (summary.error) {
    console.error("[sla-monitor] RPC get_broadcaster_sla_summary error:", summary.error);
    return withCors(
      {
        error: "Failed to fetch broadcaster SLA summary",
        details: process.env.NODE_ENV === "development" ? summary.error.message : undefined,
      },
      500,
      req,
    );
  }

  const violations = await supabase.rpc("get_broadcaster_sla_violations", {
    p_broadcaster_id: broadcasterId,
  });

  if (violations.error) {
    console.error("[sla-monitor] RPC get_broadcaster_sla_violations error:", violations.error);
    return withCors(
      {
        error: "Failed to fetch broadcaster SLA violations",
        details: process.env.NODE_ENV === "development" ? violations.error.message : undefined,
      },
      500,
      req,
    );
  }

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

async function handleClaim(
  req: Request,
  supabase: ReturnType<typeof getSupabaseClient>,
  params: { violationId: string },
): Promise<Response> {
  const { violationId } = params;

  const { data, error } = await supabase.rpc("claim_sla_compensation", {
    p_violation_id: violationId,
  });

  if (error) {
    console.error("[sla-monitor] RPC claim_sla_compensation error:", error);
    return withCors(
      {
        error: "Failed to claim compensation",
        details: process.env.NODE_ENV === "development" ? error.message : undefined,
      },
      500,
      req,
    );
  }

  return withCors(
    { ok: true, result: data?.[0] || data },
    200,
    req,
  );
}

async function handleSample(
  req: Request,
  supabase: ReturnType<typeof getSupabaseClient>,
  params: { streamId: string; sampleType: string; value: number; detail?: Record<string, unknown> },
): Promise<Response> {
  const { streamId, sampleType, value, detail } = params;

  await recordSlaMetricSample(supabase, streamId, sampleType, value, detail);

  return withCors(
    { ok: true, message: `Recorded ${sampleType} sample for stream ${streamId}` },
    200,
    req,
  );
}

// ============================================================================
// Main entrypoint
// ============================================================================

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

    const rawBody = await req.json().catch(() => null);
    const request = validateRequest(rawBody);
    const supabase = getSupabaseClient();

    switch (request.action) {
      case "monitor":
        return await handleMonitor(req, supabase);
      case "check":
        return await handleCheck(req, supabase, request);
      case "subscription":
        return await handleSubscription(req, supabase, request);
      case "broadcaster":
        return await handleBroadcaster(req, supabase, request);
      case "claim":
        return await handleClaim(req, supabase, request);
      case "sample":
        return await handleSample(req, supabase, request);
      default:
        return withCors(
          { error: `Unhandled action: ${(request as any).action}` },
          400,
          req,
        );
    }
  } catch (err) {
    console.error("[sla-monitor] Error:", err);

    const message = err instanceof Error ? err.message : "Unknown error";
    const isClientError = message.includes("Missing or invalid") || message.includes("Unknown action");

    return withCors(
      {
        error: isClientError ? message : "Internal server error",
        ...(process.env.NODE_ENV === "development" && !isClientError ? { details: message } : {}),
      },
      isClientError ? 400 : 500,
      req,
    );
  }
});
