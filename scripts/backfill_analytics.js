const fs = require('fs');
const readline = require('readline');
const zlib = require('zlib');
const crypto = require('crypto');
const postgres = require('postgres');

const sql = postgres(process.env.DATABASE_URL);

// Bot patterns matching analytics.ts
const SEARCH_ENGINE_PATTERNS = {
  Googlebot: /googlebot|adsbot|mediapartners-google/i,
  Bingbot: /bingbot|bingpreview|msnbot/i,
  Baiduspider: /baiduspider/i,
  YandexBot: /yandexbot|yandeximages/i,
  DuckDuckBot: /duckduckbot|duckassistbot/i,
  Sogou: /sogou/i,
  SeznamBot: /seznambot/i,
};

const AI_AGENT_PATTERNS = {
  GPTBot: /gptbot/i,
  ChatGPTUser: /chatgpt-user/i,
  OAISearchBot: /oai-searchbot/i,
  ClaudeBot: /claudebot|anthropic-ai/i,
  PerplexityBot: /perplexitybot/i,
  Applebot: /applebot/i,
  MetaAgent: /meta-externalagent/i,
  Amazonbot: /amazonbot/i,
  Bytespider: /bytespider/i,
  Cohere: /cohere-ai/i,
  QwenBot: /qwenbot/i,
  GrokBot: /grokbot/i,
  HuaweiCrawler: /huaweicrawler/i,
};

const SOCIAL_PREVIEW_PATTERNS = {
  WhatsApp: /whatsapp/i,
  TelegramBot: /telegrambot/i,
  Twitterbot: /twitterbot/i,
  FacebookExternalHit: /facebookexternalhit/i,
  Slackbot: /slackbot/i,
  Discordbot: /discordbot/i,
  LinkedInBot: /linkedinbot/i,
  Embedly: /embedly/i,
  Pinterest: /pinterest/i,
};

const MONITOR_PATTERNS = {
  UptimeRobot: /uptimerobot/i,
  Pingdom: /pingdom/i,
  BetterUptime: /betteruptime/i,
  UptimeKuma: /uptime-kuma/i,
};

const SCANNER_AGENT_PATTERNS = {
  PaloAlto: /paloalto|cortex-xpanse/i,
  Censys: /censys/i,
  Shodan: /shodan/i,
  Masscan: /masscan/i,
  Zgrab: /zgrab/i,
  InternetMeasurement: /internet-measurement/i,
  Netcraft: /netcraft/i,
  BinaryEdge: /binaryedge/i,
  SecurityScan: /leakix|projectdiscovery|nuclei|nikto/i,
};

const MALICIOUS_PATH_PATTERNS = [
  /\/\.env/i,
  /\/\.git/i,
  /\/\.ssh/i,
  /\/id_rsa/i,
  /\/\.kube/i,
  /\/\.aws/i,
  /\/\.config/i,
  /\/\.ds_store/i,
  /\/Jenkinsfile/i,
  /\/owa\b/i,
  /\/solr\b/i,
  /\/wp-(admin|login|content|includes)/i,
  /\/phpmyadmin/i,
  /\/server-status/i,
  /\/nginx_status/i,
  /\/actuator/i,
  /\/boaform/i,
  /\/autodiscover/i,
  /\/api\/fs\//i,
  /\/error_log/i,
  /\/graphql/i,
  /\/dns-query/i,
  /\/account$/i,
  /\/signup$/i,
  /\/aaa9/i,
];

const STATIC_EXT_REGEX = /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?|map|ttf|webmanifest|json|txt|xml|html)($|\?)/i;

function detectBot(ua, landingPath, host) {
  if (landingPath && MALICIOUS_PATH_PATTERNS.some(p => p.test(landingPath))) {
    return { isBot: true, category: 'malicious_scanner', name: 'Vulnerability Probe' };
  }
  if (host && /^[0-9.]+(:[0-9]+)?$/.test(host)) {
    return { isBot: true, category: 'malicious_scanner', name: 'Raw IP Scanner' };
  }
  if (!ua || ua.trim() === '') {
    return { isBot: true, category: 'malicious_scanner', name: 'Empty User-Agent' };
  }
  if (/^(curl|wget|python-requests|python|node-fetch|axios|go-http-client|okhttp|libwww-perl|headless|phantomjs|puppeteer|playwright|postman)/i.test(ua)) {
    return { isBot: true, category: 'malicious_scanner', name: 'HTTP Script / CLI' };
  }
  for (const [name, regex] of Object.entries(SEARCH_ENGINE_PATTERNS)) {
    if (regex.test(ua)) return { isBot: true, category: 'search_engine', name };
  }
  for (const [name, regex] of Object.entries(AI_AGENT_PATTERNS)) {
    if (regex.test(ua)) return { isBot: true, category: 'ai_agent', name };
  }
  for (const [name, regex] of Object.entries(SOCIAL_PREVIEW_PATTERNS)) {
    if (regex.test(ua)) return { isBot: true, category: 'social_preview', name };
  }
  for (const [name, regex] of Object.entries(MONITOR_PATTERNS)) {
    if (regex.test(ua)) return { isBot: true, category: 'uptime_monitor', name };
  }
  for (const [name, regex] of Object.entries(SCANNER_AGENT_PATTERNS)) {
    if (regex.test(ua)) return { isBot: true, category: 'malicious_scanner', name };
  }
  if (/\bbot\b|crawl|spider|slurp|monitor/i.test(ua)) {
    return { isBot: true, category: 'search_engine', name: 'Generic Crawler' };
  }
  return { isBot: false };
}

function parseMonth(mon) {
  const m = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
  return m[mon] || '01';
}

function parseNginxDate(dateStr) {
  // e.g. 19/Sep/2026:00:00:50 +0000
  const match = dateStr.match(/^(\d{2})\/([A-Za-z]{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2})\s+([+\-]\d{4})/);
  if (!match) return null;
  const [, day, mon, year, hour, min, sec, tz] = match;
  const month = parseMonth(mon);
  const iso = `${year}-${month}-${day}T${hour}:${min}:${sec}${tz.slice(0, 3)}:${tz.slice(3)}`;
  const dateKey = `${year}-${month}-${day}`;
  return { iso, dateKey, timestamp: new Date(iso) };
}

function categorizePage(path) {
  if (MALICIOUS_PATH_PATTERNS.some(p => p.test(path))) return 'scanner_probe';
  if (path === '/' || path === '') return 'home';
  if (path.startsWith('/docs')) return 'docs';
  if (path.startsWith('/pricing')) return 'pricing';
  if (path.startsWith('/checkout')) return 'checkout';
  if (path.startsWith('/robots.txt') || path.startsWith('/sitemap')) return 'meta';
  if (/^\/[a-zA-Z0-9_-]+$/.test(path)) return 'profile';
  return 'other';
}

async function main() {
  console.log('--- Step 1: Roll up existing human data from page_visits into analytics_daily_rollups ---');
  await sql.unsafe(`
    INSERT INTO analytics_daily_rollups (date, page_group, source, country, is_bot, bot_category, bot_name, visit_count, unique_sessions)
    SELECT 
      DATE(created_at) as date,
      CASE 
        WHEN landing_path = '/' THEN 'home'
        WHEN landing_path LIKE '/docs%' THEN 'docs'
        WHEN landing_path LIKE '/pricing%' THEN 'pricing'
        WHEN landing_path LIKE '/checkout%' THEN 'checkout'
        WHEN landing_path LIKE '/blog%' THEN 'blog'
        ELSE 'profile'
      END as page_group,
      COALESCE(source, 'direct') as source,
      COALESCE(country, 'XX') as country,
      COALESCE(is_bot, false) as is_bot,
      bot_category,
      bot_name,
      COUNT(*) as visit_count,
      COUNT(DISTINCT session_id) as unique_sessions
    FROM page_visits
    GROUP BY 1, 2, 3, 4, 5, 6, 7
    ON CONFLICT (date, page_group, source, country, is_bot, bot_category, bot_name)
    DO UPDATE SET 
      visit_count = EXCLUDED.visit_count,
      unique_sessions = EXCLUDED.unique_sessions;
  `);
  console.log('✔ Existing page_visits successfully rolled up into analytics_daily_rollups.');

  console.log('\n--- Step 2: Processing 15 Nginx access log files ---');
  const logFiles = [
    '/var/log/nginx/access.log',
    '/var/log/nginx/access.log.1',
    '/var/log/nginx/access.log.2.gz',
    '/var/log/nginx/access.log.3.gz',
    '/var/log/nginx/access.log.4.gz',
    '/var/log/nginx/access.log.5.gz',
    '/var/log/nginx/access.log.6.gz',
    '/var/log/nginx/access.log.7.gz',
    '/var/log/nginx/access.log.8.gz',
    '/var/log/nginx/access.log.9.gz',
    '/var/log/nginx/access.log.10.gz',
    '/var/log/nginx/access.log.11.gz',
    '/var/log/nginx/access.log.12.gz',
    '/var/log/nginx/access.log.13.gz',
    '/var/log/nginx/access.log.14.gz',
  ];

  const rollups = new Map();
  const rawBotVisits = [];
  const LOG_REGEX = /^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) (\S+) \S+" (\d+) \d+ "([^"]*)" "([^"]*)"/;

  let totalLines = 0;
  let botHits = 0;

  for (const filePath of logFiles) {
    if (!fs.existsSync(filePath)) {
      console.log(`Skipping missing file: ${filePath}`);
      continue;
    }

    const isGz = filePath.endsWith('.gz');
    const inputStream = isGz 
      ? fs.createReadStream(filePath).pipe(zlib.createGunzip())
      : fs.createReadStream(filePath);

    const rl = readline.createInterface({ input: inputStream, crlfDelay: Infinity });

    for await (const line of rl) {
      totalLines++;
      const match = line.match(LOG_REGEX);
      if (!match) continue;

      const [, ip, dateStr, method, fullPath, status, referer, ua] = match;

      // Clean path
      const pathOnly = fullPath.split('?')[0];

      // Skip static assets and internal tracking calls
      if (pathOnly.startsWith('/_next/') || pathOnly.startsWith('/api/track') || pathOnly.startsWith('/favicon')) continue;
      if (STATIC_EXT_REGEX.test(pathOnly)) continue;

      const botResult = detectBot(ua, pathOnly);
      if (!botResult.isBot) continue;

      botHits++;
      const parsedDate = parseNginxDate(dateStr);
      if (!parsedDate) continue;

      const pageGroup = categorizePage(pathOnly);
      const source = botResult.name || 'bot';
      const botCategory = botResult.category || 'search_engine';
      const botName = botResult.name || 'Bot';
      const country = 'XX';

      // Rollup key
      const key = `${parsedDate.dateKey}|${pageGroup}|${source}|${country}|true|${botCategory}|${botName}`;
      if (!rollups.has(key)) {
        rollups.set(key, {
          date: parsedDate.dateKey,
          page_group: pageGroup,
          source: source,
          country: country,
          is_bot: true,
          bot_category: botCategory,
          bot_name: botName,
          visit_count: 0,
          unique_ips: new Set(),
        });
      }

      const item = rollups.get(key);
      item.visit_count++;
      item.unique_ips.add(ip);

      const botCat = String(botCategory).slice(0, 32);
      const botNm = String(botName).slice(0, 64);
      const uaSnip = ua ? ua.slice(0, 250) : null;

      // Raw visit entry for recent 14-day history in page_visits
      // Salted IP hash for session
      const ipHash = crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16);
      rawBotVisits.push({
        created_at: parsedDate.iso,
        landing_path: pathOnly.slice(0, 500),
        source: source.slice(0, 64),
        country: country,
        is_bot: true,
        bot_category: botCat,
        bot_name: botNm,
        user_agent_snippet: uaSnip,
        session_id: `bot_${ipHash}`,
      });
    }

    console.log(`Processed ${filePath} (running bot count: ${botHits})`);
  }

  console.log(`\n✔ Log parsing complete: ${totalLines} lines scanned, found ${botHits} crawler/bot visits.`);
  console.log(`Aggregated into ${rollups.size} distinct daily rollup buckets.`);

  console.log('\n--- Step 3: Upserting bot rollups into analytics_daily_rollups ---');
  for (const item of rollups.values()) {
    await sql`
      INSERT INTO analytics_daily_rollups (
        date, page_group, source, country, is_bot, bot_category, bot_name, visit_count, unique_sessions
      ) VALUES (
        ${item.date}, ${item.page_group}, ${item.source}, ${item.country}, ${item.is_bot},
        ${item.bot_category}, ${item.bot_name}, ${item.visit_count}, ${item.unique_ips.size}
      )
      ON CONFLICT (date, page_group, source, country, is_bot, bot_category, bot_name)
      DO UPDATE SET
        visit_count = analytics_daily_rollups.visit_count + EXCLUDED.visit_count,
        unique_sessions = GREATEST(analytics_daily_rollups.unique_sessions, EXCLUDED.unique_sessions)
    `;
  }
  console.log('✔ Daily rollups successfully upserted.');

  console.log('\n--- Step 4: Backfilling raw bot rows into page_visits table ---');
  console.log(`Inserting ${rawBotVisits.length} raw bot visit records in chunks of 500...`);
  
  const CHUNK_SIZE = 500;
  for (let i = 0; i < rawBotVisits.length; i += CHUNK_SIZE) {
    const chunk = rawBotVisits.slice(i, i + CHUNK_SIZE);
    await sql`
      INSERT INTO page_visits ${sql(chunk, 'created_at', 'landing_path', 'source', 'country', 'is_bot', 'bot_category', 'bot_name', 'user_agent_snippet', 'session_id')}
    `;
    if ((i / CHUNK_SIZE) % 10 === 0 || i + CHUNK_SIZE >= rawBotVisits.length) {
      console.log(`Inserted ${Math.min(i + CHUNK_SIZE, rawBotVisits.length)} / ${rawBotVisits.length} records...`);
    }
  }

  console.log('\n--- Step 5: Final Validation ---');
  const rollupTotal = await sql`
    SELECT is_bot, COUNT(*) as rollup_rows, SUM(visit_count) as total_visits
    FROM analytics_daily_rollups
    GROUP BY is_bot
  `;
  console.log('analytics_daily_rollups summary:', rollupTotal);

  const pvBots = await sql`
    SELECT is_bot, bot_category, COUNT(*) 
    FROM page_visits 
    GROUP BY is_bot, bot_category 
    ORDER BY is_bot, count DESC
  `;
  console.log('page_visits summary:', pvBots);

  await sql.end();
  console.log('✔ All backfill operations completed successfully!');
}

main().catch(err => {
  console.error('Backfill error:', err);
  process.exit(1);
});
