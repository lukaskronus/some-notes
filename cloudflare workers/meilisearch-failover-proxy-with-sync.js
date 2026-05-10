// meilisearch-failover-proxy-with-extras.js
// Cloudflare Worker — Meilisearch reverse proxy with:
//   • Automatic failover between Render (primary) and Koyeb (standby)
//   • Per-instance config health check (filterable attributes)
//   • Telegram alerts for failover, recovery, and config patches
//   • On-failover trigger: calls your separate sync worker to warm up Koyeb
//   • Recovery detection: switches back to primary when it comes back
//
// ── Secrets to add in Workers dashboard → Settings → Variables ──────────────
// TELEGRAM_BOT_TOKEN   # from BotFather
// TELEGRAM_CHAT_ID     # your personal or group chat ID
// MASTER_KEY           # your Meilisearch master key
// SYNC_WORKER_URL      # full URL of your meilisearch-sync worker
// SYNC_SECRET          # must match SYNC_SECRET in your sync worker

const INSTANCES = [
  { name: "Render", origin: "https://your-app.onrender.com" },  // 👈 change (primary)
  { name: "Koyeb", origin: "https://your-app.koyeb.app"   },   // 👈 change (standby)
];

const INDEX_NAME       = "your-index"; // 👈 change
const TIMEOUT_MS       = 5000;
const HEALTH_CHECK_TTL = 60; // seconds between config checks per instance

// Cache key that stores which instance is currently "active"
// "0" = primary (Render), "1" = standby (Koyeb)
const ACTIVE_INDEX_CACHE_KEY = "https://worker-meili-active-index/state";
const ACTIVE_INDEX_TTL       = 300; // 5 minutes — refresh state after this long

const REQUIRED_SETTINGS = {
  filterableAttributes: ["parent_path_hashes"],
};

// ─── Telegram ────────────────────────────────────────────────────────────────

async function sendTelegram(env, message) {
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  try {
    await fetch(url, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id:    env.TELEGRAM_CHAT_ID,
        text:       message,
        parse_mode: "Markdown",
      }),
    });
  } catch (err) {
    console.log("[Telegram] Failed to send:", err.message);
  }
}

// ─── Sync Worker Trigger ──────────────────────────────────────────────────────

// Called after failover to warm up Koyeb with fresh Supabase data.
async function triggerSync(env, target = "koyeb") {
  if (!env.SYNC_WORKER_URL || !env.SYNC_SECRET) {
    console.log("[Sync Trigger] SYNC_WORKER_URL or SYNC_SECRET not set — skipping");
    return;
  }

  try {
    const url = `${env.SYNC_WORKER_URL}?target=${target}&secret=${env.SYNC_SECRET}`;
    const res = await fetch(url, { method: "GET" });
    console.log(`[Sync Trigger] Called sync worker for "${target}" — status ${res.status}`);
  } catch (err) {
    console.log("[Sync Trigger] Failed to call sync worker:", err.message);
    await sendTelegram(
      env,
      `⚠️ *Sync Trigger Failed After Failover*\n` +
      `Could not reach sync worker\n` +
      `Error: \`${err.message}\`\n` +
      `Koyeb may have stale or empty index — manual sync recommended.`
    );
  }
}

// ─── Active Instance State ────────────────────────────────────────────────────
// We store which instance index (0 or 1) is currently active in the Cache API.
// This lets the cron job detect recovery (primary came back) vs staying on standby.

async function getActiveIndex() {
  const cache  = caches.default;
  const cached = await cache.match(ACTIVE_INDEX_CACHE_KEY);
  if (!cached) return 0; // default: primary
  const text = await cached.text();
  const idx  = parseInt(text, 10);
  return isNaN(idx) ? 0 : idx;
}

async function setActiveIndex(index, ctx) {
  const cache = caches.default;
  ctx.waitUntil(
    cache.put(
      ACTIVE_INDEX_CACHE_KEY,
      new Response(String(index), {
        headers: { "Cache-Control": `max-age=${ACTIVE_INDEX_TTL}` },
      })
    )
  );
}

// ─── Config Patch ─────────────────────────────────────────────────────────────

async function checkAndPatch(origin, instanceName, env, ctx) {
  const cacheKey = `https://worker-health-flag/${origin}`;
  const cache    = caches.default;

  // Skip if checked recently
  const cached = await cache.match(cacheKey);
  if (cached) return;

  try {
    const res = await fetch(
      `${origin}/indexes/${INDEX_NAME}/settings/filterable-attributes`,
      {
        headers: {
          "Authorization": `Bearer ${env.MASTER_KEY}`,
          "Content-Type":  "application/json",
        },
      }
    );

    if (!res.ok) return;

    const current = await res.json();
    const missing  = REQUIRED_SETTINGS.filterableAttributes.filter(
      (attr) => !current.includes(attr)
    );

    if (missing.length > 0) {
      ctx.waitUntil(applyPatch(origin, instanceName, missing, env));
    }

    ctx.waitUntil(
      cache.put(
        cacheKey,
        new Response("ok", {
          headers: { "Cache-Control": `max-age=${HEALTH_CHECK_TTL}` },
        })
      )
    );
  } catch (err) {
    console.log(`[Health] Check failed for ${instanceName}:`, err.message);
  }
}

async function applyPatch(origin, instanceName, missingAttrs, env) {
  try {
    const res = await fetch(`${origin}/indexes/${INDEX_NAME}/settings`, {
      method:  "PATCH",
      headers: {
        "Authorization": `Bearer ${env.MASTER_KEY}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify(REQUIRED_SETTINGS),
    });

    const task = await res.json();

    await sendTelegram(
      env,
      `⚠️ *Meilisearch Config Fixed* (via Proxy)\n` +
      `Instance: *${instanceName}*\n` +
      `Restored: \`${missingAttrs.join(", ")}\`\n` +
      `Task ID: \`${task.taskUid}\``
    );
  } catch (err) {
    await sendTelegram(
      env,
      `🔴 *Meilisearch Patch Failed* (via Proxy)\n` +
      `Instance: *${instanceName}*\n` +
      `Error: \`${err.message}\``
    );
  }
}

// ─── Proxy ────────────────────────────────────────────────────────────────────

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timed out")), ms)
    ),
  ]);
}

async function proxyRequest(origin, request) {
  const url    = new URL(request.url);
  const target = origin + url.pathname + url.search;

  return await withTimeout(
    fetch(new Request(target, {
      method:  request.method,
      headers: request.headers,
      body:    ["GET", "HEAD"].includes(request.method) ? null : request.body,
    })),
    TIMEOUT_MS
  );
}

// ─── Instance Reachability Check (for cron recovery detection) ────────────────

async function isInstanceReachable(origin) {
  try {
    const res = await withTimeout(
      fetch(`${origin}/health`, { method: "GET" }),
      TIMEOUT_MS
    );
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

export default {

  // ── Cron ──────────────────────────────────────────────────────────────────
  // Runs every 3 minutes (set in Workers dashboard).
  // 1. Checks config on all instances (same as before).
  // 2. If currently on standby, checks whether primary has recovered.
  //    If recovered → switch back, alert, no sync needed (primary was never cleared).
  async scheduled(event, env, ctx) {
    console.log("[Cron] Running periodic health check");

    // Config health check on all instances
    for (const instance of INSTANCES) {
      const cacheKey = `https://worker-health-flag/${instance.origin}`;
      await caches.default.delete(cacheKey);
      ctx.waitUntil(checkAndPatch(instance.origin, instance.name, env, ctx));
    }

    // Recovery check: only relevant if we're currently on standby
    const activeIndex = await getActiveIndex();

    if (activeIndex > 0) {
      // We're on standby — check if primary is back
      const primaryUp = await isInstanceReachable(INSTANCES[0].origin);

      if (primaryUp) {
        console.log("[Cron] Primary recovered — switching back");
        await setActiveIndex(0, ctx);

        ctx.waitUntil(
          sendTelegram(
            env,
            `✅ *Primary Recovered*\n` +
            `*${INSTANCES[0].name}* is back online\n` +
            `Traffic has been switched back from *${INSTANCES[activeIndex].name}*\n` +
            `No sync needed — primary index was untouched during failover`
          )
        );
      } else {
        console.log(`[Cron] Still on standby (${INSTANCES[activeIndex].name}), primary still down`);
      }
    } else {
      console.log("[Cron] Primary is active — no recovery check needed");
    }
  },

  // ── Fetch ─────────────────────────────────────────────────────────────────
  async fetch(request, env, ctx) {

    // Background config check on all instances
    for (const instance of INSTANCES) {
      ctx.waitUntil(checkAndPatch(instance.origin, instance.name, env, ctx));
    }

    let lastError    = null;
    let activeIndex  = await getActiveIndex();

    // Build attempt order: start from current active instance, then try others
    // This means if we're already on standby, we try standby first before primary
    const order = [];
    for (let i = 0; i < INSTANCES.length; i++) {
      order.push((activeIndex + i) % INSTANCES.length);
    }

    for (let attempt = 0; attempt < order.length; attempt++) {
      const idx      = order[attempt];
      const instance = INSTANCES[idx];

      try {
        const response = await proxyRequest(instance.origin, request);

        if (response.status >= 500) {
          throw new Error(`${instance.name} returned HTTP ${response.status}`);
        }

        // ── Failover: we had to step away from the current active ──────────
        if (idx !== activeIndex) {
          const previousInstance = INSTANCES[activeIndex];
          await setActiveIndex(idx, ctx);

          ctx.waitUntil(
            sendTelegram(
              env,
              `🟡 *Meilisearch Failover Activated*\n` +
              `*${previousInstance.name}* is down\n` +
              `Now serving from: *${instance.name}*\n` +
              `Failed with: \`${lastError}\`\n` +
              `⏳ Triggering index sync to ${instance.name}…`
            )
          );

          // Trigger sync worker to warm up the newly active standby
          ctx.waitUntil(triggerSync(env, instance.name.toLowerCase()));
        }

        return response;

      } catch (err) {
        lastError = err.message;
        console.log(`[Proxy] ${instance.name} failed:`, err.message);
      }
    }

    // All instances down
    ctx.waitUntil(
      sendTelegram(
        env,
        `🔴 *All Meilisearch Instances Down*\n` +
        `Both Render and Koyeb are unreachable\n` +
        `Last error: \`${lastError}\``
      )
    );

    return new Response(
      JSON.stringify({ error: "Search is temporarily unavailable." }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  },
};
