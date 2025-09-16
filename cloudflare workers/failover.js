/**
 * Cloudflare Worker for DNS-based failover between two Cloudflare Tunnels with rate limiting awareness, Telegram notifications,
 * proactive switch-back to Tunnel 1, and KV namespace for state tracking.
 * Scheduled to run every 3 minutes to check reachability and switch tunnels if necessary.
 *
 * Prerequisites:
 * - Bind the following secrets to the Worker environment:
 *   - CLOUDFLARE_API_TOKEN: API token with permissions for Zone:DNS:Edit and Account:Cloudflare Tunnel:Edit.
 *   - ACCOUNT_ID: Your Cloudflare account ID.
 *   - ZONE_ID: The zone ID for the domain.
 *   - TUNNEL1_ID: The tunnel ID for the primary tunnel.
 *   - TUNNEL2_ID: The tunnel ID for the secondary tunnel.
 *   - SERVICE_URL: The internal service URL (e.g., "http://192.168.96.15:80").
 *   - TELEGRAM_BOT_TOKEN: Telegram bot token from @BotFather.
 *   - TELEGRAM_CHAT_ID: Telegram chat ID for notifications.
 * - Bind the KV namespace:
 *   - Namespace: FAILOVER_STATE
 *   - Variable name: FAILOVER_STATE
 * - Deploy with a cron trigger
 */

export default {
  async scheduled(event, env, ctx) {
    const domain = 'application.example.com';
    const serviceUrl = env.SERVICE_URL;
    const accountId = env.ACCOUNT_ID;
    const zoneId = env.ZONE_ID;
    const tunnel1Id = env.TUNNEL1_ID;
    const tunnel2Id = env.TUNNEL2_ID;
    const tunnel1Cname = `${tunnel1Id}.cfargotunnel.com`;
    const tunnel2Cname = `${tunnel2Id}.cfargotunnel.com`;
    const telegramBotToken = env.TELEGRAM_BOT_TOKEN;
    const telegramChatId = env.TELEGRAM_CHAT_ID;

    const headers = {
      'Authorization': `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json',
    };

    const getTimestamp = () => new Date().toISOString();

    try {
      // Check current tunnel state from KV
      let tunnelState = await env.FAILOVER_STATE.get('tunnel_state') || 'preferred';

      // Step 1: Check if the domain is reachable
      const initialReachable = await checkReachable(domain);
      if (initialReachable && tunnelState === 'failover') {
        // Domain is on Tunnel 2 and reachable; attempt switch back to Tunnel 1
        const message = `[${getTimestamp()}] Domain ${domain} is reachable on Tunnel 2. Attempting switch back to Tunnel 1.`;
        console.log(message);
        await sendTelegramNotification(telegramBotToken, telegramChatId, message);

        const dnsRecord = await getDnsRecord(zoneId, domain, headers);
        if (dnsRecord.content === tunnel1Cname) {
          console.log(`[${getTimestamp()}] Already on Tunnel 1. Updating state to preferred.`);
          await env.FAILOVER_STATE.put('tunnel_state', 'preferred');
          return;
        }

        await removeTunnelRule(accountId, tunnel2Id, domain, headers);
        const removeMessage = `[${getTimestamp()}] Removed public hostname ${domain} from previous tunnel ${tunnel2Id}.`;
        console.log(removeMessage);
        await sendTelegramNotification(telegramBotToken, telegramChatId, removeMessage);

        await ensureTunnelRule(accountId, tunnel1Id, domain, serviceUrl, headers);
        await updateDnsRecord(zoneId, dnsRecord.id, tunnel1Cname, headers);

        const switchMessage = `[${getTimestamp()}] Switched DNS back to ${tunnel1Cname} (Tunnel ${tunnel1Id}).`;
        console.log(switchMessage);
        await sendTelegramNotification(telegramBotToken, telegramChatId, switchMessage);

        await new Promise(resolve => setTimeout(resolve, 60000));
        let reachableAfter = await checkReachable(domain);
        let recheckAttempts = 1;
        while (!reachableAfter && recheckAttempts < 3) {
          const recheckDelay = 20000;
          await new Promise(resolve => setTimeout(resolve, recheckDelay));
          reachableAfter = await checkReachable(domain);
          recheckAttempts++;
          console.log(`[${getTimestamp()}] Switch-back recheck attempt ${recheckAttempts}: ${reachableAfter ? 'reachable' : 'unreachable'}.`);
        }

        if (!reachableAfter) {
          const failMessage = `[${getTimestamp()}] Switch-back to Tunnel 1 failed. Reverting to ${tunnel2Cname}.`;
          console.log(failMessage);
          await sendTelegramNotification(telegramBotToken, telegramChatId, failMessage);
          await removeTunnelRule(accountId, tunnel1Id, domain, headers);
          await ensureTunnelRule(accountId, tunnel2Id, domain, serviceUrl, headers);
          await updateDnsRecord(zoneId, dnsRecord.id, tunnel2Cname, headers);
          await env.FAILOVER_STATE.put('tunnel_state', 'failover');
        } else {
          const successMessage = `[${getTimestamp()}] Switch-back to Tunnel 1 successful after ${recheckAttempts} recheck(s).`;
          console.log(successMessage);
          await sendTelegramNotification(telegramBotToken, telegramChatId, successMessage);
          await env.FAILOVER_STATE.put('tunnel_state', 'preferred');
        }
        return;
      }

      if (initialReachable) {
        console.log(`[${getTimestamp()}] Domain ${domain} is reachable. No action needed.`);
        const dnsRecord = await getDnsRecord(zoneId, domain, headers);
        if (tunnelState !== 'preferred' && dnsRecord.content === tunnel1Cname) {
          await env.FAILOVER_STATE.put('tunnel_state', 'preferred');
        }
        return;
      }

      const message = `[${getTimestamp()}] Domain ${domain} is unreachable. Initiating failover.`;
      console.log(message);
      await sendTelegramNotification(telegramBotToken, telegramChatId, message);

      // Retrieve current DNS record
      const dnsRecord = await getDnsRecord(zoneId, domain, headers);
      const previousCname = dnsRecord.content;
      const previousTunnelId = previousCname === tunnel1Cname ? tunnel1Id : (previousCname === tunnel2Cname ? tunnel2Id : null);

      // Determine target tunnel for switch
      let newCname;
      if (previousCname === tunnel1Cname) {
        newCname = tunnel2Cname;
      } else if (previousCname === tunnel2Cname) {
        newCname = tunnel1Cname;
      } else {
        newCname = tunnel1Cname;
        console.log(`[${getTimestamp()}] Unexpected CNAME: ${previousCname}. Defaulting to Tunnel 1.`);
      }

      const targetTunnelId = newCname === tunnel1Cname ? tunnel1Id : tunnel2Id;

      // Step 2 & 3: Clean up previous tunnel and ensure target tunnel configuration
      if (previousTunnelId && previousTunnelId !== targetTunnelId) {
        await removeTunnelRule(accountId, previousTunnelId, domain, headers);
        const removeMessage = `[${getTimestamp()}] Removed public hostname ${domain} from previous tunnel ${previousTunnelId}.`;
        console.log(removeMessage);
        await sendTelegramNotification(telegramBotToken, telegramChatId, removeMessage);
      }
      await ensureTunnelRule(accountId, targetTunnelId, domain, serviceUrl, headers);
      await updateDnsRecord(zoneId, dnsRecord.id, newCname, headers);

      const switchMessage = `[${getTimestamp()}] Switched DNS to ${newCname} (Tunnel ${targetTunnelId}).`;
      console.log(switchMessage);
      await sendTelegramNotification(telegramBotToken, telegramChatId, switchMessage);

      // Step 4: Wait for propagation and recheck
      await new Promise(resolve => setTimeout(resolve, 60000));
      let reachableAfter = await checkReachable(domain);
      let recheckAttempts = 1;
      while (!reachableAfter && recheckAttempts < 3) {
        const recheckDelay = 20000;
        await new Promise(resolve => setTimeout(resolve, recheckDelay));
        reachableAfter = await checkReachable(domain);
        recheckAttempts++;
        console.log(`[${getTimestamp()}] Recheck attempt ${recheckAttempts}: ${reachableAfter ? 'reachable' : 'unreachable'}.`);
      }

      if (!reachableAfter) {
        const failMessage = `[${getTimestamp()}] Domain still unreachable after switch. Both tunnels appear down. Reverting to ${previousCname}.`;
        console.log(failMessage);
        await sendTelegramNotification(telegramBotToken, telegramChatId, failMessage);
        await removeTunnelRule(accountId, targetTunnelId, domain, headers);
        await updateDnsRecord(zoneId, dnsRecord.id, previousCname, headers);
        if (previousTunnelId) {
          await ensureTunnelRule(accountId, previousTunnelId, domain, serviceUrl, headers);
        }
        await env.FAILOVER_STATE.put('tunnel_state', previousCname === tunnel1Cname ? 'preferred' : 'failover');
      } else {
        const successMessage = `[${getTimestamp()}] Switch successful after ${recheckAttempts} recheck(s). Domain is now reachable via ${newCname}.`;
        console.log(successMessage);
        await sendTelegramNotification(telegramBotToken, telegramChatId, successMessage);
        await env.FAILOVER_STATE.put('tunnel_state', newCname === tunnel1Cname ? 'preferred' : 'failover');
      }
    } catch (error) {
      const errorMessage = `[${getTimestamp()}] Failover process failed: ${error.message}`;
      console.error(errorMessage);
      await sendTelegramNotification(telegramBotToken, telegramChatId, errorMessage);
    }
  },
};

async function checkReachable(domain) {
  const methods = ['HEAD', 'GET'];

  for (const method of methods) {
    try {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 5000); // 5-second timeout

      const response = await fetch(`https://${domain}`, {
        method,
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        },
      });

      if (response.ok) {
        console.log(`[${new Date().toISOString()}] ${method} request succeeded: ${response.status}`);
        return true;
      } else {
        console.log(`[${new Date().toISOString()}] ${method} request failed: ${response.status}`);
      }
    } catch (error) {
      console.log(`[${new Date().toISOString()}] ${method} request failed: ${error.message}`);
    }
  }
  return false;
}

async function getDnsRecord(zoneId, domain, headers) {
  const response = await fetchWithRetry(
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?type=CNAME&name=${domain}`,
    { headers }
  );

  const data = await response.json();

  if (!data.success || data.result.length === 0) {
    throw new Error(`No CNAME record found for ${domain}`);
  }

  return data.result[0];
}

async function updateDnsRecord(zoneId, recordId, newContent, headers) {
  const response = await fetchWithRetry(
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${recordId}`,
    {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ content: newContent }),
    }
  );

  const data = await response.json();

  if (!data.success) {
    throw new Error(`Failed to update DNS record: ${data.errors?.[0]?.message || 'Unknown error'}`);
  }
}

async function ensureTunnelRule(accountId, tunnelId, domain, serviceUrl, headers) {
  const getResponse = await fetchWithRetry(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/cfd_tunnel/${tunnelId}/configurations`,
    { headers }
  );

  const getData = await getResponse.json();

  if (!getData.success) {
    throw new Error(`Failed to retrieve tunnel configuration: ${getData.errors?.[0]?.message || 'Unknown error'}`);
  }

  const config = getData.result.config || { ingress: [] };
  let ingress = config.ingress || [];

  let ruleIndex = ingress.findIndex(rule => rule.hostname === domain);
  if (ruleIndex === -1) {
    ingress.unshift({
      hostname: domain,
      service: serviceUrl,
      originRequest: {},
    });
  } else if (ingress[ruleIndex].service !== serviceUrl) {
    ingress[ruleIndex].service = serviceUrl;
  } else {
    return;
  }

  if (!ingress.some(rule => rule.service === 'http_status:404')) {
    ingress.push({ service: 'http_status:404' });
  }

  const putResponse = await fetchWithRetry(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/cfd_tunnel/${tunnelId}/configurations`,
    {
      method: 'PUT',
      headers,
      body: JSON.stringify({ config: { ingress } }),
    }
  );

  const putData = await putResponse.json();

  if (!putData.success) {
    throw new Error(`Failed to update tunnel configuration: ${putData.errors?.[0]?.message || 'Unknown error'}`);
  }
}

async function removeTunnelRule(accountId, tunnelId, domain, headers) {
  const getResponse = await fetchWithRetry(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/cfd_tunnel/${tunnelId}/configurations`,
    { headers }
  );

  const getData = await getResponse.json();

  if (!getData.success) {
    throw new Error(`Failed to retrieve tunnel configuration for removal: ${getData.errors?.[0]?.message || 'Unknown error'}`);
  }

  const config = getData.result.config || { ingress: [] };
  let ingress = config.ingress || [];

  const ruleIndex = ingress.findIndex(rule => rule.hostname === domain);
  if (ruleIndex !== -1) {
    ingress.splice(ruleIndex, 1);
  } else {
    return;
  }

  if (ingress.length === 0 || !ingress.some(rule => rule.service === 'http_status:404')) {
    ingress.push({ service: 'http_status:404' });
  }

  const putResponse = await fetchWithRetry(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/cfd_tunnel/${tunnelId}/configurations`,
    {
      method: 'PUT',
      headers,
      body: JSON.stringify({ config: { ingress } }),
    }
  );

  const putData = await putResponse.json();

  if (!putData.success) {
    throw new Error(`Failed to remove tunnel rule: ${putData.errors?.[0]?.message || 'Unknown error'}`);
  }
}

async function sendTelegramNotification(botToken, chatId, message) {
  try {
    const response = await fetchWithRetry(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'Markdown',
        }),
      }
    );

    const data = await response.json();
    if (!data.ok) {
      console.error(`[${new Date().toISOString()}] Telegram notification failed: ${data.description}`);
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Telegram notification error: ${error.message}`);
  }
}

async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.status === 429 && attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`[${new Date().toISOString()}] Rate limit hit, retrying after ${delay}ms (attempt ${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      return response;
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
    }
  }
}
