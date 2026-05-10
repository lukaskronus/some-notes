// openlist-tunnel-failover.js
// Cloudflare Worker — DNS-based failover between two Cloudflare Tunnels for OpenList.
// Runs on a cron trigger (recommended: every 3 minutes → */3 * * * *)
//
// ── Secrets to add in Workers dashboard → Settings → Variables ──────────────
// CLOUDFLARE_API_TOKEN  # API token with DNS Edit + Tunnel Read/Write permissions
// ACCOUNT_ID            # Cloudflare account ID
// ZONE_ID               # Cloudflare zone ID for your domain
// TUNNEL1_ID            # Tunnel ID for office server (primary)
// TUNNEL2_ID            # Tunnel ID for home server  (standby)
// SERVICE_URL           # Internal service URL tunnels forward to (e.g. http://localhost:3000)
// DOMAIN                # The public domain to manage (e.g. openlist.mydomain.com)
// TELEGRAM_BOT_TOKEN    # From BotFather
// TELEGRAM_CHAT_ID      # Your personal or group chat ID

export default {
  async scheduled(event, env, ctx) {
    const manager = new FailoverManager(env);
    await manager.run();
  },
};

// ─── Constants ────────────────────────────────────────────────────────────────

const REACH_TIMEOUT_MS  = 10_000; // per attempt
const REACH_RETRIES     = 3;
const REACH_RETRY_DELAY = 2_000;  // ms between reach retries
const API_RETRY_DELAY   = 1_000;  // ms base delay for API retries (multiplied by attempt)
const API_MAX_RETRIES   = 3;

// ─── FailoverManager ─────────────────────────────────────────────────────────

class FailoverManager {
  constructor(env) {
    // All config from environment — nothing hard-coded
    this.domain   = env.DOMAIN;
    this.service  = env.SERVICE_URL;
    this.account  = env.ACCOUNT_ID;
    this.zone     = env.ZONE_ID;

    this.tunnels = [
      { id: env.TUNNEL1_ID, cname: `${env.TUNNEL1_ID}.cfargotunnel.com`, label: "Tunnel-1 (Office/Primary)" },
      { id: env.TUNNEL2_ID, cname: `${env.TUNNEL2_ID}.cfargotunnel.com`, label: "Tunnel-2 (Home/Standby)"  },
    ];

    this.headers = {
      "Authorization": `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
      "Content-Type":  "application/json",
    };

    this.telegram = {
      token:  env.TELEGRAM_BOT_TOKEN,
      chatId: env.TELEGRAM_CHAT_ID,
    };
  }

  // ── Entry Point ─────────────────────────────────────────────────────────────

  async run() {
    try {
      const reachable = await this.isDomainReachable();

      if (reachable) {
        // Site is up — check if we need to recover back to primary
        await this.checkRecovery();
        return;
      }

      // Site is down — start failover
      await this.notify(`🚨 *${this.domain} is unreachable*\nInitiating failover process…`);
      await this.failover();

    } catch (err) {
      await this.notify(`❌ *Failover script error*\n\`${err.message}\``);
    }
  }

  // ── Recovery ────────────────────────────────────────────────────────────────
  // Called when the domain is reachable. If we're currently on standby,
  // and the primary tunnel is healthy, switch back to primary automatically.

  async checkRecovery() {
    const dns     = await this.getDnsRecord();
    const current = this.tunnelByCname(dns.content);

    // Already on primary — nothing to do
    if (!current || current.id === this.tunnels[0].id) return;

    console.log("[Recovery] On standby, checking if primary is healthy…");

    const primaryHealthy = await this.isTunnelHealthy(this.tunnels[0].id);

    if (!primaryHealthy) {
      console.log("[Recovery] Primary still unhealthy — staying on standby");
      return;
    }

    // Primary is back — switch back
    console.log("[Recovery] Primary recovered — switching back");

    await this.notify(
      `🔄 *Primary Tunnel Recovered*\n` +
      `*${this.tunnels[0].label}* is healthy again\n` +
      `Switching back from *${current.label}*…`
    );

    await this.addTunnelRule(this.tunnels[0].id);
    await this.updateDnsRecord(dns.id, this.tunnels[0].cname);
    await this.removeTunnelRule(current.id);

    await this.notify(
      `✅ *Recovery Complete*\n` +
      `Traffic restored to *${this.tunnels[0].label}*\n` +
      `Domain: \`${this.domain}\``
    );
  }

  // ── Failover ────────────────────────────────────────────────────────────────

  async failover() {
    const dns     = await this.getDnsRecord();
    const current = this.tunnelByCname(dns.content);
    const target  = current
      ? this.tunnels.find(t => t.id !== current.id)  // switch to the other one
      : this.tunnels[0];                              // unknown state → default to primary

    console.log(`[Failover] Current: ${current?.label ?? "unknown"} → Target: ${target.label}`);

    // Verify target is healthy before switching
    const targetHealthy = await this.isTunnelHealthy(target.id);
    if (!targetHealthy) {
      await this.notify(
        `❌ *Failover Aborted*\n` +
        `Target *${target.label}* is not healthy\n` +
        `Both tunnels may be down — manual intervention required`
      );
      return;
    }

    // Execute switchover
    await this.addTunnelRule(target.id);
    await this.updateDnsRecord(dns.id, target.cname);
    if (current) await this.removeTunnelRule(current.id);

    await this.notify(
      `✅ *Failover Complete*\n` +
      `From: *${current?.label ?? "unknown"}*\n` +
      `To: *${target.label}*\n` +
      `Domain: \`${this.domain}\`\n` +
      `_Recovery check will run automatically on next cron cycle_`
    );
  }

  // ── Domain Reachability ──────────────────────────────────────────────────────

  async isDomainReachable() {
    // Try both with and without trailing slash to reduce false positives
    const [a, b] = await Promise.allSettled([
      this.attemptReach(`https://${this.domain}`),
      this.attemptReach(`https://${this.domain}/`),
    ]);

    return (
      (a.status === "fulfilled" && a.value) ||
      (b.status === "fulfilled" && b.value)
    );
  }

  async attemptReach(url) {
    for (let attempt = 0; attempt < REACH_RETRIES; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REACH_TIMEOUT_MS);

      try {
        const res = await fetch(url, {
          method:   "GET",
          signal:   controller.signal,
          redirect: "follow",
          headers:  {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
              "AppleWebKit/537.36 (KHTML, like Gecko) " +
              "Chrome/129.0.0.0 Safari/537.36",
          },
        });
        clearTimeout(timer);

        // Any response under 500 means the tunnel + server are alive
        if (res.status >= 200 && res.status < 500) return true;

      } catch {
        clearTimeout(timer);
      }

      if (attempt < REACH_RETRIES - 1) {
        await sleep(REACH_RETRY_DELAY);
      }
    }

    return false;
  }

  // ── Tunnel Health ────────────────────────────────────────────────────────────

  async isTunnelHealthy(tunnelId) {
    try {
      const res  = await this.apiFetch(
        `https://api.cloudflare.com/client/v4/accounts/${this.account}/cfd_tunnel/${tunnelId}`
      );
      const data = await res.json();
      return data.success && data.result.status === "healthy";
    } catch {
      return false;
    }
  }

  // ── Tunnel Config ────────────────────────────────────────────────────────────

  async addTunnelRule(tunnelId) {
    const config = await this.getTunnelConfig(tunnelId);
    let ingress  = config.ingress ?? [];

    // Remove any existing rule for this domain, then prepend the new one
    ingress = ingress.filter(r => r.hostname !== this.domain);
    ingress.unshift({
      hostname:      this.domain,
      service:       this.service,
      originRequest: {},
    });

    // Always ensure the mandatory catch-all fallback is last
    ingress = ingress.filter(r => r.hostname || r.service !== "http_status:404");
    ingress.push({ service: "http_status:404" });

    await this.updateTunnelConfig(tunnelId, { ingress });
  }

  async removeTunnelRule(tunnelId) {
    const config = await this.getTunnelConfig(tunnelId);
    let ingress  = (config.ingress ?? []).filter(r => r.hostname !== this.domain);

    // Preserve the mandatory catch-all
    ingress = ingress.filter(r => r.hostname || r.service !== "http_status:404");
    ingress.push({ service: "http_status:404" });

    await this.updateTunnelConfig(tunnelId, { ingress });
  }

  async getTunnelConfig(tunnelId) {
    const res  = await this.apiFetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.account}/cfd_tunnel/${tunnelId}/configurations`
    );
    const data = await res.json();
    if (!data.success) throw new Error(`Get tunnel config: ${data.errors?.[0]?.message ?? "unknown"}`);
    return data.result.config ?? { ingress: [] };
  }

  async updateTunnelConfig(tunnelId, config) {
    const res  = await this.apiFetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.account}/cfd_tunnel/${tunnelId}/configurations`,
      { method: "PUT", body: JSON.stringify({ config }) }
    );
    const data = await res.json();
    if (!data.success) throw new Error(`Update tunnel config: ${data.errors?.[0]?.message ?? "unknown"}`);
  }

  // ── DNS ──────────────────────────────────────────────────────────────────────

  async getDnsRecord() {
    const res  = await this.apiFetch(
      `https://api.cloudflare.com/client/v4/zones/${this.zone}/dns_records?type=CNAME&name=${this.domain}`
    );
    const data = await res.json();
    if (!data.success || data.result.length === 0) {
      throw new Error(`No CNAME record found for ${this.domain}`);
    }
    return data.result[0];
  }

  async updateDnsRecord(recordId, cname) {
    const res  = await this.apiFetch(
      `https://api.cloudflare.com/client/v4/zones/${this.zone}/dns_records/${recordId}`,
      { method: "PATCH", body: JSON.stringify({ content: cname }) }
    );
    const data = await res.json();
    if (!data.success) throw new Error(`Update DNS: ${data.errors?.[0]?.message ?? "unknown"}`);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  // Find a tunnel object by its CNAME value
  tunnelByCname(cname) {
    return this.tunnels.find(t => t.cname === cname) ?? null;
  }

  // Fetch with retry + rate-limit back-off
  async apiFetch(url, options = {}) {
    for (let attempt = 1; attempt <= API_MAX_RETRIES; attempt++) {
      try {
        const res = await fetch(url, { headers: this.headers, ...options });
        if (res.status === 429 && attempt < API_MAX_RETRIES) {
          await sleep(API_RETRY_DELAY * attempt);
          continue;
        }
        return res;
      } catch (err) {
        if (attempt === API_MAX_RETRIES) throw err;
        await sleep(API_RETRY_DELAY * attempt);
      }
    }
  }

  async notify(message) {
    if (!this.telegram.token || !this.telegram.chatId) return;
    try {
      await fetch(
        `https://api.telegram.org/bot${this.telegram.token}/sendMessage`,
        {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id:    this.telegram.chatId,
            text:       message,
            parse_mode: "Markdown",
          }),
        }
      );
    } catch {
      // Silent fail — notification errors should never block failover logic
    }
  }
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
