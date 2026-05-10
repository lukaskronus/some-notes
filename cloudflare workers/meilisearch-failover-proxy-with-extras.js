// meilisearch-failover-proxy-with-extras.js
// Cloudflare Worker — Meilisearch reverse proxy with:
//   • Automatic failover between Render (primary) and Koyeb (standby)
//   • Per-instance config health check (filterable attributes)
//   • Active instance state tracking via Cache API
//   • Recovery detection — switches back to primary automatically
//   • Empty index detection — triggers OpenList index rebuild via API
//   • Telegram alerts for all events
//
// ── Secrets to add in Workers dashboard → Settings → Variables ──────────────
// TELEGRAM_BOT_TOKEN   # from BotFather
// TELEGRAM_CHAT_ID     # your personal or group chat ID
// MASTER_KEY           # your Meilisearch master key
// OPENLIST_URL         # your OpenList instance URL (e.g. https://openlist.mydomain.com)
// OPENLIST_USERNAME    # OpenList admin username
// OPENLIST_PASSWORD    # OpenList admin password

const INSTANCES = [
  { name: "Render", origin: "https://your-app.onrender.com" },  // 👈 change (primary)
  { name: "Koyeb",  origin: "https://your-app.koyeb.app"   },  // 👈 change (standby)
];

const INDEX_NAME       = "your-index"; // 👈 change
const TIMEOUT_MS       = 5000;
const HEALTH_CHECK_TTL = 60; // seconds between config checks per instance

// Cache key that stores which instance index (0 or 1) is currently active
// "0" = primary (Render), "1" = standby (Koyeb)
const ACTIVE_INDEX_CACHE_KEY = "https://worker-meili-active-index/state";
const ACTIVE_INDEX_TTL       = 300; // 5 minutes

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

// ─── Active Instance State ────────────────────────────────────────────────────
// Stores which instance (0 = primary, 1 = standby) is currently serving traffic.
// Used by cron to detect when primary has recovered so it can switch back.

async function getActiveIndex() {
  const cache  = caches.default;
  const cached = await cache.match(ACTIVE_INDEX_CACHE_KEY);
  if (!cached) return 0; // default: primary
  const text = await cached.text();
  const idx   = parseInt(text, 10);
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

// ─── Instance Reachability Check ─────────────────────────────────────────────

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
      // Patch in the background — never blocks search requests
      ctx.waitUntil(applyPatch(origin, instanceName, missing, env));
    }

    // Mark as checked for HEALTH_CHECK_TTL seconds
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
    const res  = await fetch(`${origin}/indexes/${INDEX_NAME}/settings`, {
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

// ─── Index Build ──────────────────────────────────────────────────────────────
// Called when the active Meilisearch instance has 0 documents.
// Logs into OpenList and triggers a full index rebuild via admin API.

async function getDocumentCount(origin, env) {
  const res = await fetch(
    `${origin}/indexes/${INDEX_NAME}/stats`,
    {
      headers: {
        "Authorization": `Bearer ${env.MASTER_KEY}`,
        "Content-Type":  "application/json",
      },
    }
  );
  if (res.status === 404) return -1; // index doesn't exist yet
  if (!res.ok) return null;          // unknown error — skip rebuild to be safe
  const data = await res.json();
  return data.numberOfDocuments ?? 0;
}

async function openlistLogin(env) {
  if (!env.OPENLIST_URL || !env.OPENLIST_USERNAME || !env.OPENLIST_PASSWORD) {
    throw new Error("OPENLIST_URL, OPENLIST_USERNAME, or OPENLIST_PASSWORD not set");
  }

  const res = await fetch(`${env.OPENLIST_URL}/api/auth/login`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: env.OPENLIST_USERNAME,
      password: env.OPENLIST_PASSWORD,
    }),
  });

  if (!res.ok) throw new Error(`OpenList login failed [${res.status}]`);

  const data = await res.json();
  if (data.code !== 200) throw new Error(`OpenList login error: ${data.message}`);

  return data.data.token;
}

async function triggerIndexBuild(instanceName, env) {
  const token = await openlistLogin(env);

  const res = await fetch(`${env.OPENLIST_URL}/api/admin/index/build`, {
    method:  "POST",
    headers: {
      "Authorization": token, // OpenList uses raw token, not "Bearer"
      "Content-Type":  "application/json",
    },
    body: JSON.stringify({}),
  });

  if (!res.ok) throw new Error(`Index build trigger failed [${res.status}]`);

  const data = await res.json();
  if (data.code !== 200) throw new Error(`Index build error: ${data.message}`);

  await sendTelegram(
    env,
    `🔄 *OpenList Index Rebuild Triggered*\n` +
    `Meilisearch instance: *${instanceName}*\n` +
    `Reason: index was empty\n` +
    `_Search will become available once indexing completes_`
  );
}

async function checkAndRebuildIfEmpty(origin, instanceName, env, ctx) {
  try {
    const count = await getDocumentCount(origin, env);

    if (count === null) {
      console.log(`[IndexBuild] Could not get document count for ${instanceName} — skipping`);
      return;
    }
    if (count === -1) {
      console.log(`[IndexBuild] Index not found on ${instanceName} — skipping`);
      return;
    }
    if (count === 0) {
      console.log(`[IndexBuild] Index empty on ${instanceName} — triggering rebuild`);
      ctx.waitUntil(
        triggerIndexBuild(instanceName, env).catch(async (err) => {
          console.log(`[IndexBuild] Failed for ${instanceName}:`, err.message);
          await sendTelegram(
            env,
            `🔴 *OpenList Index Rebuild Failed*\n` +
            `Instance: *${instanceName}*\n` +
            `Error: \`${err.message}\`\n` +
            `Manual action required: OpenList admin → Indexes → Build`
          );
        })
      );
    } else {
      console.log(`[IndexBuild] ${instanceName} has ${count} documents — healthy`);
    }
  } catch (err) {
    console.log(`[IndexBuild] Check failed for ${instanceName}:`, err.message);
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

// ─── Main Handler ─────────────────────────────────────────────────────────────

export default {

  // ── Cron ──────────────────────────────────────────────────────────────────
  // Runs every 3 minutes (set in Workers dashboard).
  // 1. Config health check on all instances
  // 2. Empty index check on all instances — triggers rebuild if needed
  // 3. Recovery check — if on standby, checks if primary is back
  async scheduled(event, env, ctx) {
    console.log("[Cron] Running periodic health check");

    for (const instance of INSTANCES) {
      // Force bypass cache so cron always does a real check
      const cacheKey = `https://worker-health-flag/${instance.origin}`;
      await caches.default.delete(cacheKey);

      ctx.waitUntil(checkAndPatch(instance.origin, instance.name, env, ctx));
      ctx.waitUntil(checkAndRebuildIfEmpty(instance.origin, instance.name, env, ctx));
    }

    // Recovery check: only relevant if currently on standby
    const activeIndex = await getActiveIndex();

    if (activeIndex > 0) {
      const primaryUp = await isInstanceReachable(INSTANCES[0].origin);

      if (primaryUp) {
        console.log("[Cron] Primary recovered — switching back");
        await setActiveIndex(0, ctx);

        ctx.waitUntil(
          sendTelegram(
            env,
            `✅ *Primary Recovered*\n` +
            `*${INSTANCES[0].name}* is back online\n` +
            `Traffic switched back from *${INSTANCES[activeIndex].name}*`
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

    // ── Status endpoint ───────────────────────────────────────────────────
    // Visit your worker URL with ?status to see which instance is active.
    // Example: https://your-worker.workers.dev/?status
    const url = new URL(request.url);
    if (url.searchParams.has("status")) {
      const activeIndex = await getActiveIndex();
      const active      = INSTANCES[activeIndex];
      const docCount    = await getDocumentCount(active.origin, env);
      const primaryUp   = await isInstanceReachable(INSTANCES[0].origin);
      const standbyUp   = await isInstanceReachable(INSTANCES[1].origin);

      const status = {
        active: {
          name:      active.name,
          origin:    active.origin,
          index:     activeIndex,
          documents: docCount ?? "unknown",
        },
        instances: INSTANCES.map((inst, i) => ({
          name:    inst.name,
          origin:  inst.origin,
          healthy: i === 0 ? primaryUp : standbyUp,
        })),
        mode: activeIndex === 0 ? "normal" : "failover",
      };

      return new Response(JSON.stringify(status, null, 2), {
        status:  200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Background config check on all instances
    for (const instance of INSTANCES) {
      ctx.waitUntil(checkAndPatch(instance.origin, instance.name, env, ctx));
    }

    let lastError   = null;
    let activeIndex = await getActiveIndex();

    // Start from current active instance, then try others
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

        // Failover: we stepped away from the current active instance
        if (idx !== activeIndex) {
          const previousInstance = INSTANCES[activeIndex];
          await setActiveIndex(idx, ctx);

          ctx.waitUntil(
            sendTelegram(
              env,
              `🟡 *Meilisearch Failover Activated*\n` +
              `*${previousInstance.name}* is down\n` +
              `Now serving from: *${instance.name}*\n` +
              `Failed with: \`${lastError}\``
            )
          );
        }

        return response;

      } catch (err) {
        lastError = err.message;
        console.log(`[Proxy] ${instance.name} failed:`, err.message);
      }
    }

    // Both down
    ctx.waitUntil(
      sendTelegram(
        env,
        `🔴 *Both Meilisearch Instances Down*\n` +
        `All instances are unreachable\n` +
        `Last error: \`${lastError}\``
      )
    );

    return new Response(
      JSON.stringify({ error: "Search is temporarily unavailable." }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  },
};
