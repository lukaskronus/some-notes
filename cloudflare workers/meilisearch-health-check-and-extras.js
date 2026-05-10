// meilisearch-health-check-and-filterable-attributes.js
// Cloudflare Worker — health check for Meilisearch instances used by OpenList.
// Runs on a cron trigger (recommended: every 5 minutes → */5 * * * *)
//
// ── Secrets to add in Workers dashboard → Settings → Variables ──────────────
// TELEGRAM_BOT_TOKEN     # from BotFather
// TELEGRAM_CHAT_ID       # your personal or group chat ID
// MASTER_KEY             # your Meilisearch master key
// OPENLIST_URL           # your OpenList instance URL (e.g. https://openlist.mydomain.com)
// OPENLIST_USERNAME      # OpenList admin username
// OPENLIST_PASSWORD      # OpenList admin password
//
// ── What this worker does ───────────────────────────────────────────────────
// 1. Checks filterable attributes on the Meilisearch instance
//    → If missing, patches them and alerts via Telegram
// 2. Checks document count on the Meilisearch index
//    → If 0, logs into OpenList and triggers a full index build via API
//    → Alerts via Telegram either way (triggered or failed)

const INDEX_NAME = "your-index"; // 👈 change this

const REQUIRED_SETTINGS = {
  filterableAttributes: ["parent_path_hashes"],
};

// ─── Telegram ─────────────────────────────────────────────────────────────────

async function sendTelegram(env, message) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;
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

// ─── Meilisearch helpers ──────────────────────────────────────────────────────

function meiliHeaders(env) {
  return {
    "Authorization": `Bearer ${env.MASTER_KEY}`,
    "Content-Type":  "application/json",
  };
}

async function getFilterableAttributes(origin, env) {
  const res = await fetch(
    `${origin}/indexes/${INDEX_NAME}/settings/filterable-attributes`,
    { headers: meiliHeaders(env) }
  );
  if (!res.ok) throw new Error(`GET filterable-attributes failed [${res.status}]`);
  return res.json(); // string[]
}

async function patchSettings(origin, env) {
  const res = await fetch(`${origin}/indexes/${INDEX_NAME}/settings`, {
    method:  "PATCH",
    headers: meiliHeaders(env),
    body:    JSON.stringify(REQUIRED_SETTINGS),
  });
  if (!res.ok) throw new Error(`PATCH settings failed [${res.status}]`);
  return res.json(); // Meilisearch task object
}

// Returns total document count for the index, or -1 if the index doesn't exist yet
async function getDocumentCount(origin, env) {
  const res = await fetch(
    `${origin}/indexes/${INDEX_NAME}/stats`,
    { headers: meiliHeaders(env) }
  );

  if (res.status === 404) return -1; // index doesn't exist yet
  if (!res.ok) throw new Error(`GET index stats failed [${res.status}]`);

  const data = await res.json();
  return data.numberOfDocuments ?? 0;
}

// ─── OpenList helpers ─────────────────────────────────────────────────────────

// Logs into OpenList and returns a JWT token
async function openlistLogin(env) {
  if (!env.OPENLIST_URL || !env.OPENLIST_USERNAME || !env.OPENLIST_PASSWORD) {
    throw new Error("OPENLIST_URL, OPENLIST_USERNAME, or OPENLIST_PASSWORD secret not set");
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

// Triggers a full index build in OpenList via admin API
async function triggerIndexBuild(env) {
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

  return data;
}

// ─── Main check ───────────────────────────────────────────────────────────────

export async function checkAndPatch(origin, instanceName, env) {
  const results = {
    settings: null,
    documents: null,
    indexBuild: null,
  };

  // ── Step 1: Check and patch filterable attributes ──────────────────────────
  try {
    const current = await getFilterableAttributes(origin, env);
    const missing  = REQUIRED_SETTINGS.filterableAttributes.filter(
      (attr) => !current.includes(attr)
    );

    if (missing.length === 0) {
      console.log(`[${instanceName}] Settings OK`);
      results.settings = "ok";
    } else {
      console.log(`[${instanceName}] Missing attrs: ${missing.join(", ")} — patching`);
      const task = await patchSettings(origin, env);
      results.settings = "patched";

      await sendTelegram(
        env,
        `⚠️ *Meilisearch Config Fixed*\n` +
        `Instance: *${instanceName}*\n` +
        `Restored: \`${missing.join(", ")}\`\n` +
        `Task ID: \`${task.taskUid}\``
      );
    }
  } catch (err) {
    console.log(`[${instanceName}] Settings check error:`, err.message);
    results.settings = "error";

    await sendTelegram(
      env,
      `🔴 *Meilisearch Settings Check Failed*\n` +
      `Instance: *${instanceName}*\n` +
      `Error: \`${err.message}\``
    );
  }

  // ── Step 2: Check document count — trigger rebuild if empty ───────────────
  try {
    const count = await getDocumentCount(origin, env);
    console.log(`[${instanceName}] Document count: ${count}`);

    if (count === -1) {
      // Index doesn't exist at all yet — settings patch above should have created it
      // Nothing more to do here; OpenList will populate on first use
      console.log(`[${instanceName}] Index not found — may not have been built yet`);
      results.documents = "index-missing";

    } else if (count === 0) {
      // Index exists but is empty — trigger a rebuild via OpenList API
      console.log(`[${instanceName}] Index is empty — triggering OpenList index build`);

      try {
        await triggerIndexBuild(env);
        results.indexBuild = "triggered";

        await sendTelegram(
          env,
          `🔄 *OpenList Index Rebuild Triggered*\n` +
          `Instance: *${instanceName}*\n` +
          `Reason: Meilisearch index was empty\n` +
          `OpenList is now rebuilding the index in the background\n` +
          `_Search will become available once indexing completes_`
        );
      } catch (buildErr) {
        results.indexBuild = "error";
        console.log(`[${instanceName}] Index build trigger failed:`, buildErr.message);

        await sendTelegram(
          env,
          `🔴 *OpenList Index Rebuild Failed*\n` +
          `Instance: *${instanceName}*\n` +
          `Meilisearch index is empty but could not trigger rebuild\n` +
          `Error: \`${buildErr.message}\`\n` +
          `Manual action required: go to OpenList admin → Indexes → Build`
        );
      }

    } else {
      console.log(`[${instanceName}] Index healthy — ${count} documents`);
      results.documents = count;
    }

  } catch (err) {
    console.log(`[${instanceName}] Document count check error:`, err.message);
    results.documents = "error";

    await sendTelegram(
      env,
      `🔴 *Meilisearch Document Check Failed*\n` +
      `Instance: *${instanceName}*\n` +
      `Error: \`${err.message}\``
    );
  }

  return results;
}

// ─── Cron / HTTP handler ──────────────────────────────────────────────────────

export default {
  async scheduled(event, env, ctx) {
    const ORIGIN        = "https://your-app.onrender.com"; // 👈 change
    const INSTANCE_NAME = "Render";                        // 👈 change

    console.log(`[Cron] Health check for ${INSTANCE_NAME}`);
    const result = await checkAndPatch(ORIGIN, INSTANCE_NAME, env);
    console.log(`[Cron] Result:`, JSON.stringify(result));
  },

  // Optional: visit the worker URL in browser to trigger a manual check
  async fetch(request, env, ctx) {
    const ORIGIN        = "https://your-app.onrender.com"; // 👈 same as above
    const INSTANCE_NAME = "Render";

    const result = await checkAndPatch(ORIGIN, INSTANCE_NAME, env);
    return new Response(JSON.stringify(result, null, 2), {
      headers: { "Content-Type": "application/json" },
    });
  },
};
