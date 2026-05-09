// worker-health-check.js
// In Cloudflare Workers dashboard → your worker → Settings → Variables → Add Secret
// TELEGRAM_BOT_TOKEN   # from BotFather
// TELEGRAM_CHAT_ID     # your personal or group chat ID
// MASTER_KEY           # your Meilisearch master key

const INSTANCES = [
  { name: "Render", origin: "https://your-app.onrender.com" },  // 👈 change
  { name: "Koyeb", origin: "https://your-app.koyeb.app"   },   // 👈 change
];

const INDEX_NAME       = "your-index"; // 👈 change
const TIMEOUT_MS       = 5000;
const HEALTH_CHECK_TTL = 60; // seconds between config checks per instance

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

// ─── Patch Logic ─────────────────────────────────────────────

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
    const missing = REQUIRED_SETTINGS.filterableAttributes.filter(
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

// ─── Proxy ───────────────────────────────────────────────────────────────────

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

  // ─── Cron Trigger (same pattern as Script 1) ─────────────────────────────
  async scheduled(event, env, ctx) {
    console.log("[Cron] Running periodic health check on all instances");

    for (const instance of INSTANCES) {
      // Force bypass the cache so cron always does a real check
      const cacheKey = `https://worker-health-flag/${instance.origin}`;
      await caches.default.delete(cacheKey);

      ctx.waitUntil(checkAndPatch(instance.origin, instance.name, env, ctx));
    }
  },
  
  async fetch(request, env, ctx) {

    // Background config check for both instances on every request cycle
    for (const instance of INSTANCES) {
      ctx.waitUntil(checkAndPatch(instance.origin, instance.name, env, ctx));
    }

    let lastError = null;

    for (let i = 0; i < INSTANCES.length; i++) {
      const instance = INSTANCES[i];

      try {
        const response = await proxyRequest(instance.origin, request);

        if (response.status >= 500) {
          throw new Error(`${instance.name} returned HTTP ${response.status}`);
        }

        // If we're on the fallback, notify via Telegram
        if (i > 0) {
          ctx.waitUntil(
            sendTelegram(
              env,
              `🟡 *Failover Activated*\n` +
              `Primary (${INSTANCES[0].name}) is down\n` +
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
        `🔴 *Both Instances Down*\n` +
        `All Meilisearch instances are unavailable\n` +
        `Last error: \`${lastError}\``
      )
    );

    return new Response(
      JSON.stringify({ error: "Search is temporarily unavailable." }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  },
};
