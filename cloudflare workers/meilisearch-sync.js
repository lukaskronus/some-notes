// meilisearch-sync.js
// Standalone Cloudflare Worker — syncs OpenList data from Supabase into a target Meilisearch instance.
// Intended to run separately from your proxy/health-check worker.
//
// ── Secrets to add in Workers dashboard → Settings → Variables ──────────────
// SUPABASE_URL          # e.g. https://xxxx.supabase.co
// SUPABASE_SERVICE_KEY  # Service Role key (not anon key — needs full table access)
// MASTER_KEY            # Meilisearch master key (same one used in proxy worker)
// TELEGRAM_BOT_TOKEN    # from BotFather
// TELEGRAM_CHAT_ID      # your personal or group chat ID
//
// ── Optional: trigger via HTTP for on-demand sync ───────────────────────────
// Deploy this worker separately, then call its URL with:
//   GET /?target=render     → sync into Render instance
//   GET /?target=koyeb      → sync into Koyeb instance
//   GET /?target=both       → sync into both (used after failover)
//   GET /?target=both&force=true  → skip row-count sameness check
//
// ── Cron ────────────────────────────────────────────────────────────────────
// Add a cron trigger in Workers dashboard (e.g. once per day: 0 3 * * *)
// The cron always syncs to Koyeb (the standby) to keep it warm.

// ─── Config ──────────────────────────────────────────────────────────────────

const TABLE_PREFIX = "oplist_"; // must match OpenList's table_prefix in config

// OpenList stores objects (files + folders) in this table
const STORAGE_TABLE = `${TABLE_PREFIX}storage_objects`;

// The Meilisearch index name OpenList uses (must match your OpenList config)
const INDEX_NAME = "your-index"; // 👈 change to match INDEX_NAME in your proxy worker

const INSTANCES = {
  render: { name: "Render", origin: "https://your-app.onrender.com" }, // 👈 change
  koyeb:  { name: "Koyeb",  origin: "https://your-app.koyeb.app"   }, // 👈 change
};

// How many rows to fetch from Supabase per page (stay under Workers memory limit)
const PAGE_SIZE = 500;

// Meilisearch batch size for document POSTs
const MEILI_BATCH_SIZE = 200;

const REQUIRED_SETTINGS = {
  filterableAttributes: ["parent_path_hashes"],
};

// ─── Telegram ─────────────────────────────────────────────────────────────────

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
    console.log("[Telegram] Failed:", err.message);
  }
}

// ─── Supabase ────────────────────────────────────────────────────────────────

// Returns all rows from the storage_objects table, paginated to avoid memory spikes.
// Supabase PostgREST uses Range headers for pagination.
async function fetchAllFromSupabase(env) {
  const rows = [];
  let from   = 0;
  let done   = false;

  while (!done) {
    const to  = from + PAGE_SIZE - 1;
    const url = `${env.SUPABASE_URL}/rest/v1/${STORAGE_TABLE}?select=*&order=id.asc`;

    const res = await fetch(url, {
      headers: {
        "apikey":        env.SUPABASE_SERVICE_KEY,
        "Authorization": `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        "Range":         `${from}-${to}`,
        "Range-Unit":    "items",
      },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Supabase fetch failed [${res.status}]: ${body}`);
    }

    const page = await res.json();

    if (!Array.isArray(page) || page.length === 0) {
      done = true;
    } else {
      rows.push(...page);
      // If we got fewer rows than PAGE_SIZE, we've reached the end
      if (page.length < PAGE_SIZE) {
        done = true;
      } else {
        from += PAGE_SIZE;
      }
    }
  }

  return rows;
}

// ─── Transform ───────────────────────────────────────────────────────────────

// Map a Supabase row to the document shape Meilisearch / OpenList expects.
// OpenList indexes: id, parent, name, is_dir, size, modified, path, parent_path_hashes
// Column names follow OpenList's actual schema with the table prefix stripped.
function transformRow(row) {
  return {
    id:                 String(row.id),         // Meilisearch requires string or int primary key
    parent:             row.parent      ?? "",
    name:               row.name        ?? "",
    is_dir:             row.is_dir      ?? false,
    size:               row.size        ?? 0,
    modified:           row.modified    ?? "",
    path:               row.path        ?? "",
    parent_path_hashes: row.parent_path_hashes ?? [],
  };
}

// ─── Meilisearch ─────────────────────────────────────────────────────────────

// Ensure filterableAttributes are set before pushing documents.
async function ensureSettings(origin, instanceName, env) {
  const res = await fetch(
    `${origin}/indexes/${INDEX_NAME}/settings/filterable-attributes`,
    { headers: { "Authorization": `Bearer ${env.MASTER_KEY}` } }
  );

  if (!res.ok) throw new Error(`Settings check failed [${res.status}]`);

  const current = await res.json();
  const missing  = REQUIRED_SETTINGS.filterableAttributes.filter(
    (a) => !current.includes(a)
  );

  if (missing.length > 0) {
    console.log(`[${instanceName}] Patching missing attributes: ${missing.join(", ")}`);
    const patch = await fetch(`${origin}/indexes/${INDEX_NAME}/settings`, {
      method:  "PATCH",
      headers: {
        "Authorization": `Bearer ${env.MASTER_KEY}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify(REQUIRED_SETTINGS),
    });
    if (!patch.ok) throw new Error(`Settings patch failed [${patch.status}]`);
    console.log(`[${instanceName}] Patch task queued`);
  } else {
    console.log(`[${instanceName}] Settings already correct`);
  }
}

// Push documents in batches. Returns total documents sent.
async function pushDocuments(origin, instanceName, documents, env) {
  let sent = 0;

  for (let i = 0; i < documents.length; i += MEILI_BATCH_SIZE) {
    const batch = documents.slice(i, i + MEILI_BATCH_SIZE);

    const res = await fetch(
      `${origin}/indexes/${INDEX_NAME}/documents?primaryKey=id`,
      {
        method:  "POST",
        headers: {
          "Authorization": `Bearer ${env.MASTER_KEY}`,
          "Content-Type":  "application/json",
        },
        body: JSON.stringify(batch),
      }
    );

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Document POST failed [${res.status}]: ${body}`);
    }

    const task = await res.json();
    console.log(`[${instanceName}] Batch ${i / MEILI_BATCH_SIZE + 1}: task ${task.taskUid}, sent ${batch.length} docs`);
    sent += batch.length;
  }

  return sent;
}

// ─── Core Sync ───────────────────────────────────────────────────────────────

async function syncToInstance(instance, documents, env, forcedBy) {
  const { name, origin } = instance;
  console.log(`[Sync] Starting sync to ${name} (${documents.length} docs)`);

  try {
    await ensureSettings(origin, name, env);
    const sent = await pushDocuments(origin, name, documents, env);

    const message =
      `✅ *Meilisearch Sync Complete*\n` +
      `Target: *${name}*\n` +
      `Documents synced: \`${sent}\`\n` +
      (forcedBy ? `Triggered by: \`${forcedBy}\`` : `Triggered by: \`cron\``);

    await sendTelegram(env, message);
    console.log(`[Sync] Done — ${sent} documents sent to ${name}`);
    return { success: true, sent };

  } catch (err) {
    const message =
      `🔴 *Meilisearch Sync Failed*\n` +
      `Target: *${name}*\n` +
      `Error: \`${err.message}\``;

    await sendTelegram(env, message);
    console.log(`[Sync] Failed for ${name}:`, err.message);
    return { success: false, error: err.message };
  }
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

export default {

  // ── Cron: runs on schedule, syncs only to Koyeb (standby) ─────────────────
  async scheduled(event, env, ctx) {
    console.log("[Cron] Nightly sync triggered");

    let documents;
    try {
      const rows = await fetchAllFromSupabase(env);
      documents  = rows.map(transformRow);
      console.log(`[Cron] Fetched ${documents.length} rows from Supabase`);
    } catch (err) {
      await sendTelegram(
        env,
        `🔴 *Sync Cron Failed — Supabase Fetch Error*\n\`${err.message}\``
      );
      return;
    }

    // Cron only syncs to standby (Koyeb) to keep it warm without hitting both
    ctx.waitUntil(syncToInstance(INSTANCES.koyeb, documents, env, "cron"));
  },

  // ── HTTP: on-demand sync triggered by URL ──────────────────────────────────
  async fetch(request, env, ctx) {
    const url    = new URL(request.url);
    const target = url.searchParams.get("target") ?? "koyeb"; // default: standby only

    // Simple auth guard — callers must pass ?secret=<SYNC_SECRET>
    // Add SYNC_SECRET as a secret in Workers dashboard
    const secret = url.searchParams.get("secret");
    if (!env.SYNC_SECRET || secret !== env.SYNC_SECRET) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status:  401,
        headers: { "Content-Type": "application/json" },
      });
    }

    let documents;
    try {
      const rows = await fetchAllFromSupabase(env);
      documents  = rows.map(transformRow);
    } catch (err) {
      await sendTelegram(
        env,
        `🔴 *Sync HTTP Trigger Failed — Supabase Fetch Error*\n\`${err.message}\``
      );
      return new Response(JSON.stringify({ error: err.message }), {
        status:  502,
        headers: { "Content-Type": "application/json" },
      });
    }

    const results = {};

    if (target === "render" || target === "both") {
      results.render = await syncToInstance(INSTANCES.render, documents, env, "http");
    }
    if (target === "koyeb" || target === "both") {
      results.koyeb = await syncToInstance(INSTANCES.koyeb, documents, env, "http");
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      status:  200,
      headers: { "Content-Type": "application/json" },
    });
  },
};
