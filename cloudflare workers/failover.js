/**
# Required variables
CLOUDFLARE_API_TOKEN="your-cloudflare-api-token"
ACCOUNT_ID="your-cloudflare-account-id"
TELEGRAM_BOT_TOKEN="your-telegram-bot-token"
TELEGRAM_CHAT_ID="your-telegram-chat-id"

# Multi-domain configuration (JSON format)
DOMAINS_CONFIG='[
  {
    "domain": "app1.example.com",
    "zoneId": "zone_id_1",
    "serviceUrl": "http://localhost:3000",
    "tunnels": ["tunnel1_id", "tunnel2_id", "tunnel3_id"]
  },
  {
    "domain": "app2.example.com", 
    "zoneId": "zone_id_2",
    "serviceUrl": "http://localhost:3001",
    "tunnels": ["tunnel4_id", "tunnel5_id"]
  },
  {
    "domain": "app3.example.com",
    "zoneId": "zone_id_3", 
    "serviceUrl": "http://localhost:3002",
    "tunnels": ["tunnel6_id", "tunnel7_id", "tunnel8_id", "tunnel9_id"]
  }
]'
*/

export default {
  async scheduled(event, env, ctx) {
    const accountId = env.ACCOUNT_ID;
    const telegramBotToken = env.TELEGRAM_BOT_TOKEN;
    const telegramChatId = env.TELEGRAM_CHAT_ID;
    const domainsConfig = JSON.parse(env.DOMAINS_CONFIG);

    const headers = {
      'Authorization': `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json',
    };

    const getTimestamp = () => new Date().toISOString();
    const log = (message) => console.log(`[${getTimestamp()}] ${message}`);

    // Process each domain configuration in parallel
    await Promise.allSettled(
      domainsConfig.map(config => 
        handleDomainFailover(config, accountId, headers, telegramBotToken, telegramChatId, log)
      )
    );
  },
};

async function handleDomainFailover(config, accountId, headers, telegramBotToken, telegramChatId, log) {
  const { domain, zoneId, tunnels, serviceUrl } = config;
  
  // Generate tunnel CNAMEs
  const tunnelCnames = tunnels.map(tunnelId => `${tunnelId}.cfargotunnel.com`);
  
  log(`Processing domain: ${domain}`);

  try {
    // Step 1: Check if the domain is reachable
    const isReachable = await checkReachable(`https://${domain}`);
    
    if (isReachable) {
      log(`Domain ${domain} is reachable. No action needed.`);
      return;
    }

    log(`Domain ${domain} is unreachable. Initiating failover.`);
    await sendTelegramNotification(
      telegramBotToken, 
      telegramChatId, 
      `Domain ${domain} is unreachable. Initiating failover.`
    );

    // Step 2: Get current DNS record to determine current tunnel
    const dnsRecord = await getDnsRecord(zoneId, domain, headers);
    const currentCname = dnsRecord.content;
    
    // Find current tunnel index
    const currentTunnelIndex = tunnelCnames.findIndex(cname => cname === currentCname);
    
    // Determine next healthy tunnel (round-robin)
    let nextTunnelIndex = -1;
    let nextTunnelId = null;
    let nextTunnelCname = null;
    
    // Check tunnels in order starting from the next one
    for (let i = 1; i <= tunnels.length; i++) {
      const checkIndex = (currentTunnelIndex + i) % tunnels.length;
      const tunnelId = tunnels[checkIndex];
      const tunnelHealthy = await checkTunnelHealth(accountId, tunnelId, headers);
      
      if (tunnelHealthy) {
        nextTunnelIndex = checkIndex;
        nextTunnelId = tunnelId;
        nextTunnelCname = tunnelCnames[checkIndex];
        break;
      }
    }
    
    if (nextTunnelIndex === -1) {
      const message = `No healthy tunnels found for domain ${domain}. Aborting failover.`;
      log(message);
      await sendTelegramNotification(telegramBotToken, telegramChatId, message);
      return;
    }

    // Step 3: Add hostname rule to target tunnel
    await addTunnelRule(accountId, nextTunnelId, domain, serviceUrl, headers);
    log(`Added hostname rule to tunnel ${nextTunnelId} for domain ${domain}`);

    // Step 4: Update DNS to point to the target tunnel
    await updateDnsRecord(zoneId, dnsRecord.id, nextTunnelCname, headers);
    log(`Updated DNS for ${domain} to ${nextTunnelCname}`);

    // Step 5: Remove hostname rule from previous tunnel if it exists
    if (currentTunnelIndex !== -1) {
      const currentTunnelId = tunnels[currentTunnelIndex];
      await removeTunnelRule(accountId, currentTunnelId, domain, headers);
      log(`Removed hostname rule from tunnel ${currentTunnelId} for domain ${domain}`);
    }

    const message = `Failover completed for ${domain} to ${nextTunnelCname}`;
    log(message);
    await sendTelegramNotification(telegramBotToken, telegramChatId, message);

  } catch (error) {
    const errorMessage = `Failover process failed for ${domain}: ${error.message}`;
    log(errorMessage);
    await sendTelegramNotification(telegramBotToken, telegramChatId, errorMessage);
  }
}

async function checkReachable(url) {
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 10000); // 10-second timeout
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'follow',
    });
    return response.status >= 200 && response.status < 400;
  } catch (error) {
    console.log(`[${new Date().toISOString()}] Reachability check failed for ${url}: ${error.message}`);
    return false;
  }
}

async function checkTunnelHealth(accountId, tunnelId, headers) {
  try {
    const response = await fetchWithRetry(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/cfd_tunnel/${tunnelId}`,
      { headers }
    );
    
    const data = await response.json();
    
    if (!data.success) {
      console.log(`Tunnel API response not successful for ${tunnelId}`);
      return false;
    }
    
    const tunnel = data.result;
    console.log(`Tunnel ${tunnelId} status: ${tunnel.status}`);
    
    return tunnel.status === 'healthy';
    
  } catch (error) {
    console.log(`Tunnel health check failed for tunnel ${tunnelId}: ${error.message}`);
    return false;
  }
}

async function addTunnelRule(accountId, tunnelId, domain, serviceUrl, headers) {
  try {
    // Get current tunnel configuration
    const response = await fetchWithRetry(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/cfd_tunnel/${tunnelId}/configurations`,
      { headers }
    );

    const data = await response.json();
    if (!data.success) {
      throw new Error(`Failed to get tunnel config: ${data.errors?.[0]?.message || 'Unknown error'}`);
    }

    const config = data.result.config || { ingress: [] };
    let ingress = config.ingress || [];

    // Remove existing rule for this domain if it exists
    ingress = ingress.filter(rule => rule.hostname !== domain);

    // Add new rule at the beginning
    ingress.unshift({
      hostname: domain,
      service: serviceUrl,
      originRequest: {},
    });

    // Ensure fallback rule exists
    const hasFallback = ingress.some(rule => !rule.hostname && rule.service === 'http_status:404');
    if (!hasFallback) {
      ingress.push({ service: 'http_status:404' });
    }

    // Update tunnel configuration
    const updateResponse = await fetchWithRetry(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/cfd_tunnel/${tunnelId}/configurations`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify({ config: { ingress } }),
      }
    );

    const updateData = await updateResponse.json();
    if (!updateData.success) {
      throw new Error(`Failed to update tunnel: ${updateData.errors?.[0]?.message || 'Unknown error'}`);
    }

    return true;
  } catch (error) {
    console.error(`Error adding tunnel rule: ${error.message}`);
    throw error;
  }
}

async function removeTunnelRule(accountId, tunnelId, domain, headers) {
  try {
    // Get current tunnel configuration
    const response = await fetchWithRetry(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/cfd_tunnel/${tunnelId}/configurations`,
      { headers }
    );

    const data = await response.json();
    if (!data.success) {
      throw new Error(`Failed to get tunnel config: ${data.errors?.[0]?.message || 'Unknown error'}`);
    }

    const config = data.result.config || { ingress: [] };
    let ingress = config.ingress || [];

    // Remove rule for this domain
    ingress = ingress.filter(rule => rule.hostname !== domain);

    // Ensure fallback rule exists
    const hasFallback = ingress.some(rule => !rule.hostname && rule.service === 'http_status:404');
    if (!hasFallback) {
      ingress.push({ service: 'http_status:404' });
    }

    // Update tunnel configuration
    const updateResponse = await fetchWithRetry(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/cfd_tunnel/${tunnelId}/configurations`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify({ config: { ingress } }),
      }
    );

    const updateData = await updateResponse.json();
    if (!updateData.success) {
      throw new Error(`Failed to update tunnel: ${updateData.errors?.[0]?.message || 'Unknown error'}`);
    }

    return true;
  } catch (error) {
    console.error(`Error removing tunnel rule: ${error.message}`);
    throw error;
  }
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
