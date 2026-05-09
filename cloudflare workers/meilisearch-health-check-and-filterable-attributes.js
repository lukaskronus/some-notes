// worker-health-check.js
// In Cloudflare Workers dashboard → your worker → Settings → Variables → Add Secret
// TELEGRAM_BOT_TOKEN   # from @BotFather
// TELEGRAM_CHAT_ID     # your personal or group chat ID
// MASTER_KEY           # your Meilisearch master key
// Deploy as a SEPARATE Worker with a Cron Trigger (e.g. every 5 minutes)
// Settings → Triggers → Cron Triggers → Add: */5 * * * *

const INDEX_NAME = "your-index"; // 👈 change this

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
    console.log("[Telegram] Failed to send notification:", err.message);
  }
}

// ─── Settings Check ───────────────────────────────────────────────────────────

async function getFilterableAttributes(origin, masterKey) {
  const res = await fetch(
    `${origin}/indexes/${INDEX_NAME}/settings/filterable-attributes`,
    {
      headers: {
        "Authorization": `Bearer ${masterKey}`,
        "Content-Type":  "application/json",
      },
    }
  );

  if (!res.ok) throw new Error(`Failed to GET settings: ${res.status}`);
  return await res.json(); // string[]
}

async function patchSettings(origin, masterKey) {
  const res = await fetch(`${origin}/indexes/${INDEX_NAME}/settings`, {
    method:  "PATCH",
    headers: {
      "Authorization": `Bearer ${masterKey}`,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify(REQUIRED_SETTINGS),
  });

  if (!res.ok) throw new Error(`PATCH failed: ${res.status}`);
  return await res.json(); // Meilisearch returns a task object
}

// ─── Main Check ───────────────────────────────────────────────────────────────

export async function checkAndPatch(origin, instanceName, env) {
  const masterKey = env.MASTER_KEY;

  try {
    const current = await getFilterableAttributes(origin, masterKey);

    const missing = REQUIRED_SETTINGS.filterableAttributes.filter(
      (attr) => !current.includes(attr)
    );

    if (missing.length === 0) {
      console.log(`[${instanceName}] Config OK`);
      return { status: "ok" };
    }

    // Config is out of sync — patch it
    console.log(`[${instanceName}] Missing attrs: ${missing.join(", ")} — patching...`);
    const task = await patchSettings(origin, masterKey);

    await sendTelegram(
      env,
      `⚠️ *Meilisearch Config Fixed*\n` +
      `Instance: *${instanceName}*\n` +
      `Missing attrs restored: \`${missing.join(", ")}\`\n` +
      `Task ID: \`${task.taskUid}\``
    );

    return { status: "patched", taskId: task.taskUid };

  } catch (err) {
    console.log(`[${instanceName}] Error:`, err.message);

    await sendTelegram(
      env,
      `🔴 *Meilisearch Health Check Failed*\n` +
      `Instance: *${instanceName}*\n` +
      `Error: \`${err.message}\``
    );

    return { status: "error", error: err.message };
  }
}

// ─── Cron Handler ─────────────────────────────────────────────────────────────

export default {
  // Cron trigger entry point
  async scheduled(event, env, ctx) {
    const ORIGIN        = "https://your-app.onrender.com"; // 👈 change this
    const INSTANCE_NAME = "Render";                        // 👈 change this

    console.log(`[Cron] Running health check for ${INSTANCE_NAME}`);
    const result = await checkAndPatch(ORIGIN, INSTANCE_NAME, env);
    console.log(`[Cron] Result:`, JSON.stringify(result));
  },

  // Optional: also expose a manual HTTP trigger for testing
  // Visit the worker URL in your browser to trigger a check manually
  async fetch(request, env, ctx) {
    const ORIGIN        = "https://your-app.onrender.com"; // 👈 same as above
    const INSTANCE_NAME = "Render";

    const result = await checkAndPatch(ORIGIN, INSTANCE_NAME, env);
    return new Response(JSON.stringify(result, null, 2), {
      headers: { "Content-Type": "application/json" },
    });
  },
};
