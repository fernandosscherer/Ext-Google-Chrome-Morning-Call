/* ─── Opera Proxy — Cloudflare Worker ─── */

const CORS = {
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function isAllowedOrigin(origin, env = {}) {
  if (!origin) return true
  const extOrigin = env.EXTENSION_ID ? `chrome-extension://${env.EXTENSION_ID}` : null
  return [
    'https://operatrader.com.br',
    'https://www.operatrader.com.br',
    'https://opera-proxy.datamapleai.workers.dev',
    extOrigin
  ].includes(origin) || (!env.EXTENSION_ID && origin.startsWith('chrome-extension://'))
}

function withCors(response, request, env = {}) {
  const origin = request.headers.get('Origin')
  const headers = new Headers(response.headers)
  Object.entries(CORS).forEach(([key, value]) => headers.set(key, value))
  if (origin && isAllowedOrigin(origin, env)) {
    headers.set('Access-Control-Allow-Origin', origin)
    headers.set('Vary', 'Origin')
  } else if (!origin) {
    headers.set('Access-Control-Allow-Origin', '*')
  }
  return new Response(response.body, { status: response.status, headers })
}

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS, ...extra },
  })
}

/* ─── B3 contract resolution ─── */

const MONTH = ['F','G','H','J','K','M','N','Q','U','V','X','Z']

function getBrtParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false
  })
  const parts = formatter.formatToParts(date)
  const p = {}
  parts.forEach(({type, value}) => p[type] = parseInt(value, 10))
  return p
}

function getWinExpirationDay(year, monthIndex) {
  let closestDay = 15
  let minDiff = 99
  for (let d = 11; d <= 19; d++) {
    const dt = new Date(Date.UTC(year, monthIndex, d))
    if (dt.getUTCDay() === 3) {
      const diff = Math.abs(d - 15)
      if (diff < minDiff) {
        minDiff = diff
        closestDay = d
      }
    }
  }
  return closestDay
}

function getFirstBusinessDay(year, monthIndex) {
  for (let d = 1; d <= 7; d++) {
    const dt = new Date(Date.UTC(year, monthIndex, d))
    const dayOfWeek = dt.getUTCDay()
    if (dayOfWeek >= 1 && dayOfWeek <= 5) return d
  }
  return 1
}

function resolveContract(base, refDate = null) {
  const brt = refDate ? getBrtParts(refDate) : getBrtParts()
  const y = brt.year
  const m = brt.month - 1
  const d = brt.day
  const isWin = ['WIN', 'IND'].includes(base)

  if (isWin) {
    const isEvenMonth = m % 2 === 1
    let targetMonth = m
    let targetYear = y

    if (isEvenMonth) {
      const expDay = getWinExpirationDay(y, m)
      if (d > expDay) {
        targetMonth = (m + 2) % 12
        if (targetMonth < m) targetYear++
      }
    } else {
      targetMonth = (m + 1) % 12
      if (targetMonth < m) targetYear++
    }
    const code = MONTH[targetMonth]
    const yy = targetYear % 100
    return `${base}${code}${yy}`
  } else {
    const firstBiz = getFirstBusinessDay(y, m)
    let targetMonth = m
    let targetYear = y
    if (d >= firstBiz) {
      targetMonth = (m + 1) % 12
      if (targetMonth <= m) targetYear++
    }
    const code = MONTH[targetMonth]
    const yy = targetYear % 100
    return `${base}${code}${yy}`
  }
}

/* ─── B3 market hours (BRT) ─── */

function isB3MarketOpen() {
  const brt = getBrtParts()
  const d = new Date(Date.UTC(brt.year, brt.month - 1, brt.day))
  const day = d.getUTCDay()
  if (day === 0 || day === 6) return false
  const mins = brt.hour * 60 + brt.minute
  const OPEN = 9 * 60
  const CLOSE = 18 * 60 - 5
  return mins >= OPEN && mins < CLOSE
}

/* ─── Brapi client ─── */

async function brapi(path, env) {
  const res = await fetch(`${env.BRAPI_BASE}${path}`, {
    headers: { Authorization: `Bearer ${env.BRAPI_TOKEN}` },
  })
  if (!res.ok) throw new Error(`brapi ${res.status}: ${await res.text()}`)
  return res.json()
}

/* ─── BCB/SGS client ─── */

const BCB_SERIES = { selic: 432, ipca12m: 13522, cdi: 4389 }

async function bcb(slug, env) {
  const id = BCB_SERIES[slug]
  if (!id) throw new Error(`Unknown series: ${slug}`)
  const url = `${env.BCB_BASE}/bcdata.sgs.${id}/dados/ultimos/1?formato=json`
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'OperaProxy/1.0',
      'Accept': 'application/json',
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`BCB ${res.status}: ${text.slice(0, 200)}`)
  }
  const data = await res.json()
  if (!data?.[0]) throw new Error('BCB empty response')
  return { value: parseFloat(data[0].valor), date: data[0].data }
}

/* ─── Google News RSS parser ─── */

async function googleNews(limit = 3) {
  const res = await fetch(
    'https://news.google.com/rss/search?q=economia+brasil+mercado&hl=pt-BR&gl=BR&ceid=BR:pt-419',
    {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml;q=0.9, */*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
    }
  )
  if (!res.ok) throw new Error(`Google News ${res.status}`)
  const xml = await res.text()
  const items = []
  const re = /<item>([\s\S]*?)<\/item>/g
  let match
  while ((match = re.exec(xml)) && items.length < limit) {
    const block = match[1]
    const title = block.match(/<title>(.*?)<\/title>/)?.[1] ?? ''
    const link = block.match(/<link>(.*?)<\/link>/)?.[1] ?? '#'
    const pubDate = block.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] ?? ''
    const source = block.match(/<source[^>]*>(.*?)<\/source>/)?.[1] ?? 'Google News'
    const timeAgo = pubDate ? formatTimeAgo(pubDate) : ''
    items.push({ title, url: link, source, timeAgo })
  }
  return items
}

function formatTimeAgo(dateStr) {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return ''
  const diff = Math.max(0, Date.now() - d.getTime())
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}min atr\u00e1s`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h atr\u00e1s`
  const days = Math.floor(hours / 24)
  return `${days}d atr\u00e1s`
}

/* ─── Route handlers ─── */

async function health() {
  return json({ ok: true, ts: new Date().toISOString() })
}

async function handleQuote(url, env) {
  const symbol = url.searchParams.get('symbol')
  if (!symbol) return json({ error: 'symbol required' }, 400)

  const data = await brapi(`/futures/quote?symbols=${encodeURIComponent(symbol)}`, env)
  const q = data.quotes?.[0]
  if (!q) return json({ error: 'not found' }, 404)

  return json({
    symbol: q.symbol,
    name: q.assetDescription,
    price: q.settlement ?? q.close,
    change: q.settlement ? q.settlement - (q.close ?? q.settlement) : 0,
    changePercent: q.oscillationPct ?? 0,
    isMarketOpen: isB3MarketOpen(),
    lastClose: q.close,
    lastUpdated: q.date ? new Date(q.date * 1000).toISOString() : null,
  })
}

async function handleWatchlist(url, env) {
  const symbols = url.searchParams.get('symbols') || 'WIN,WDO'
  const bases = symbols.split(',').map(s => s.trim().toUpperCase())
  const contracts = bases.map(b => resolveContract(b))
  const query = contracts.join(',')

  const data = await brapi(`/futures/quote?symbols=${encodeURIComponent(query)}`, env)

  return json((data.quotes || []).map(q => ({
    symbol: q.symbol,
    name: q.assetDescription,
    price: q.settlement ?? q.close,
    changePercent: q.oscillationPct ?? 0,
    lastClose: q.close,
  })))
}

async function handleTermStructure(url, env) {
  const symbol = url.searchParams.get('symbol') || 'WIN'
  const base = symbol.match(/^(WIN|WDO)/)?.[1] || 'WIN'
  const wantPercentile = url.searchParams.get('percentile') === 'true'

  const data = await brapi(`/futures/term-structure?asset=${base}`, env)
  const contracts = data.contracts || []

  const brt = getBrtParts()
  const startOfToday = Date.UTC(brt.year, brt.month - 1, brt.day)
  const endOfYear = Date.UTC(brt.year, 11, 31, 23, 59, 59)

  /* Ordena por vencimento crescente e mantém só o que ainda não venceu
     (contratos sem data ficam no fim). O "atual" é o primeiro válido. */
  const filtered = contracts
    .map(c => ({ c, t: c.expirationDate ? new Date(c.expirationDate).getTime() : Infinity }))
    .filter(x => !Number.isFinite(x.t) || (x.t >= startOfToday && x.t <= endOfYear))
    .sort((a, b) => a.t - b.t)
    .slice(0, 4)
    .map(x => x.c)

  const result = filtered.map((c, i) => {
    const osc = Math.abs(c.oscillationPct ?? 0)
    /* Proxy de volatilidade (não é IV de opções): derivado da oscilação
       percentual do contrato. Ver label "Vol. estimada" na extensão. */
    const iv = Math.min(80, Math.max(8, 15 + osc * 0.8))
    return {
      contract: c.symbol,
      iv: Math.round(iv * 10) / 10,
      ivEstimated: true,
      expiration: c.expirationDate,
      isCurrent: i === 0,
      settlement: c.settlement,
      close: c.close,
      oscillation: c.oscillationPct,
    }
  })

  if (wantPercentile) {
    const currentIV = result[0]?.iv ?? 20
    const percentile = Math.min(99, Math.max(1, Math.round(currentIV * 2.5)))
    return json({ percentile, iv: currentIV, estimated: true, contracts: result })
  }

  return json(result)
}

async function handleMacro(env) {
  const results = {}
  const errors = {}

  const promises = Object.entries(BCB_SERIES).map(async ([slug]) => {
    try {
      const { value, date } = await bcb(slug, env)
      return { slug, value, date }
    } catch (e) {
      return { slug, error: e.message }
    }
  })

  const data = await Promise.all(promises)
  data.forEach(d => {
    if (d.error) {
      results[d.slug] = null
      errors[d.slug] = d.error
    } else {
      results[d.slug] = d.value
      results.asOf = d.date
    }
  })

  if (Object.keys(errors).length > 0) {
    results._partial = true
  }
  return json(results)
}

async function handleNews(url) {
  const limit = parseInt(url.searchParams.get('limit') || '3', 10)
  const items = await googleNews(Math.min(limit, 10))
  return json(items)
}

/* ─── Economic calendar (HEURÍSTICA, não é o calendário oficial) ───
   As datas abaixo são aproximações recorrentes (Copom/FOMC ~ dia 15-30,
   IPCA ~ dias 8-10, Payroll = primeira sexta). Todo evento sai com
   `estimated: true` para a UI não tratar como agenda oficial.
   Fontes reais: bcbrazil, TradingView — usar quando houver integração. */

function getEconomicCalendar() {
  const brt = getBrtParts()
  const day = brt.day
  const month = brt.month - 1
  const year = brt.year
  const events = []

  const copomDates = [
    { m: 0, d: 29 }, { m: 1, d: 5 }, { m: 2, d: 19 }, { m: 3, d: 16 },
    { m: 4, d: 7 }, { m: 5, d: 18 }, { m: 6, d: 30 }, { m: 7, d: 20 },
    { m: 8, d: 17 }, { m: 9, d: 29 }, { m: 10, d: 12 }, { m: 11, d: 10 },
  ]
  for (const cd of copomDates) {
    if (cd.m === month && Math.abs(cd.d - day) <= 1) {
      events.push({ event: 'Copom (Taxa Selic)', time: '15:00', impact: 3, country: 'BR', estimated: true })
    }
  }

  if (day <= 10) {
    const ipcaDates = [8, 9, 10]
    if (ipcaDates.includes(day)) {
      events.push({ event: 'IPCA (IBGE)', time: '09:00', impact: 2, country: 'BR', estimated: true })
    }
  }

  if (day >= 1 && day <= 7 && month % 3 === 0) {
    events.push({ event: 'Balanco Comercial', time: '09:00', impact: 2, country: 'BR', estimated: true })
  }

  const fomcDates = [
    { m: 0, d: 29 }, { m: 1, d: 1 }, { m: 2, d: 19 }, { m: 3, d: 30 },
    { m: 4, d: 7 }, { m: 5, d: 18 }, { m: 6, d: 30 }, { m: 7, d: 30 },
    { m: 8, d: 17 }, { m: 9, d: 29 }, { m: 10, d: 5 }, { m: 11, d: 17 },
  ]
  for (const fd of fomcDates) {
    if (fd.m === month && Math.abs(fd.d - day) <= 1) {
      events.push({ event: 'FOMC (Fed)', time: '15:00', impact: 3, country: 'US', estimated: true })
    }
  }

  const firstOfMonth = new Date(Date.UTC(year, month, 1))
  const firstFriday = 1 + ((5 - firstOfMonth.getUTCDay() + 7) % 7)
  if (day === firstFriday) {
    events.push({ event: 'Payroll (EUA)', time: '09:30', impact: 3, country: 'US', estimated: true })
  }

  return events
}

async function handleCalendar() {
  return json(getEconomicCalendar())
}

async function handleLicense(request, env) {
  try {
    const { key } = await request.json()
    if (!key) return json({ valid: false, tier: 'free', message: 'Chave obrigat\u00f3ria.' })
    const valid = Boolean(env.FOUNDER_LICENSE_KEY) && key === env.FOUNDER_LICENSE_KEY
    return json({
      valid,
      tier: valid ? 'founder' : 'free',
      message: valid ? 'Licen\u00e7a ativa.' : 'Chave inv\u00e1lida.',
    })
  } catch {
    return json({ error: 'Invalid request' }, 400)
  }
}

/* ─── Rate limit básico em memória (por isolate) ───
   Protege contra abuso trivial. Para limite global real, usar KV/Durable
   Object ou o produto Rate Limiting da Cloudflare. */
const RATE_WINDOW_MS = 60_000
const RATE_MAX = 120
const rateBuckets = new Map()

function isRateLimited(request) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown'
  const now = Date.now()
  let bucket = rateBuckets.get(ip)
  if (!bucket || now > bucket.reset) {
    bucket = { count: 0, reset: now + RATE_WINDOW_MS }
    rateBuckets.set(ip, bucket)
  }
  bucket.count++
  if (rateBuckets.size > 5000) rateBuckets.clear()
  return bucket.count > RATE_MAX
}

/* ─── Worker entry ─── */

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return withCors(new Response(null), request, env)

    const url = new URL(request.url)

    try {
      const isProtectedRoute = url.pathname.startsWith('/api/v1/') && url.pathname !== '/api/v1/health'
      if (isProtectedRoute) {
        /* Exige Origin de navegador/extensão: bloqueia chamadas anônimas
           servidor-a-servidor que usariam o proxy para consumir o token. */
        const origin = request.headers.get('Origin')
        if (!origin || !isAllowedOrigin(origin, env)) {
          return withCors(json({ error: 'Origin not allowed' }, 403), request, env)
        }
        if (isRateLimited(request)) {
          return withCors(json({ error: 'Too many requests' }, 429, { 'Retry-After': '60' }), request, env)
        }
      }

      let response
      if (url.pathname === '/api/v1/health') response = await health()
      else if (url.pathname === '/api/v1/quote') response = await handleQuote(url, env)
      else if (url.pathname === '/api/v1/watchlist') response = await handleWatchlist(url, env)
      else if (url.pathname === '/api/v1/term-structure') response = await handleTermStructure(url, env)
      else if (url.pathname === '/api/v1/macro') response = await handleMacro(env)
      else if (url.pathname === '/api/v1/news') response = await handleNews(url)
      else if (url.pathname === '/api/v1/calendar') response = await handleCalendar()
      else if (url.pathname === '/api/v1/license/validate' && request.method === 'POST') response = await handleLicense(request, env)
      else response = json({ error: 'Not found' }, 404)

      return withCors(response, request, env)
    } catch (e) {
      console.error(e)
      return withCors(json({ error: 'Internal server error' }, 500), request, env)
    }
  },
}
