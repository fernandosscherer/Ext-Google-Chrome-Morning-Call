const USE_MOCK = false

const BRAPI_BASE = 'https://brapi.dev/api/v2/futures'

const CACHE_TTL = {
  quote: 60 * 1000,
}

/* ─── Cache helpers ─── */

async function getCache(key) {
  try {
    const result = await chrome.storage.local.get(key)
    const entry = result[key]
    if (!entry || !entry.data) return null
    if (Date.now() - entry.timestamp > entry.ttl) return null
    return entry.data
  } catch {
    return null
  }
}

async function setCache(key, data, ttl) {
  try {
    await chrome.storage.local.set({
      [key]: { data, timestamp: Date.now(), ttl },
    })
  } catch {
    // storage full or unavailable
  }
}

/* ─── Contract resolution (B3 futures) ─── */

const MONTH_CODES = ['F','G','H','J','K','M','N','Q','U','V','X','Z']
const WIN_IND_MONTHS = ['G','J','M','Q','V','Z']

function resolveCurrentContract(baseSymbol) {
  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear() % 100
  const validMonths = ['WIN', 'IND'].includes(baseSymbol) ? WIN_IND_MONTHS : MONTH_CODES

  let targetMonth = currentMonth
  for (let i = 0; i < 12; i++) {
    const m = (currentMonth + i) % 12
    const code = MONTH_CODES[m]
    if (validMonths.includes(code)) {
      targetMonth = m
      break
    }
  }

  const code = MONTH_CODES[targetMonth]
  const year = targetMonth < currentMonth ? currentYear + 1 : currentYear
  return `${baseSymbol}${code}${year}`
}

/* ─── Week calendar generator ─── */

const CALENDAR_EVENTS = [
  { country: 'US', event: 'Payroll (EUA)', time: '09:30', impact: 3 },
  { country: 'US', event: 'Taxa de Desemprego', time: '09:30', impact: 3 },
  { country: 'US', event: 'ISM Manufacturing', time: '10:45', impact: 2 },
  { country: 'US', event: 'Jobless Claims', time: '09:30', impact: 2 },
  { country: 'US', event: 'Produ\u00e7\u00e3o Industrial', time: '10:15', impact: 2 },
  { country: 'US', event: 'Confian\u00e7a do Consumidor', time: '11:00', impact: 2 },
  { country: 'US', event: 'Fed Minutes', time: '15:00', impact: 3 },
  { country: 'US', event: 'PIB (anualizado)', time: '09:30', impact: 3 },
  { country: 'US', event: 'Vendas no Varejo', time: '09:30', impact: 2 },
  { country: 'BR', event: 'IPC-FIPE', time: '08:00', impact: 2 },
  { country: 'BR', event: 'IPCA-15', time: '09:00', impact: 3 },
  { country: 'BR', event: 'Taxa Selic (Copom)', time: '18:30', impact: 3 },
  { country: 'BR', event: 'PNAD Cont\u00ednua', time: '09:00', impact: 2 },
  { country: 'BR', event: 'Produ\u00e7\u00e3o Industrial', time: '09:00', impact: 2 },
  { country: 'BR', event: 'Balan\u00e7a Comercial', time: '15:00', impact: 2 },
  { country: 'CN', event: 'CPI China', time: '22:30', impact: 2 },
  { country: 'CN', event: 'PIB China', time: '23:00', impact: 3 },
  { country: 'DE', event: 'IFO Alem\u00e3o', time: '05:00', impact: 2 },
  { country: 'UK', event: 'CPI Reino Unido', time: '08:00', impact: 2 },
  { country: 'JP', event: 'Taxa de Juros (BOJ)', time: '00:30', impact: 3 },
  { country: 'JP', event: 'Confian\u00e7a Industrial (Tankan)', time: '01:50', impact: 2 },
  { country: 'DE', event: 'ZEW Alem\u00e3o', time: '06:00', impact: 2 },
  { country: 'US', event: 'API Weekly Crude Stocks', time: '17:30', impact: 2 },
  { country: 'US', event: 'EIA Crude Stocks', time: '11:30', impact: 2 },
]

function getWeekDays() {
  const now = new Date()
  const day = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((day + 6) % 7))
  const days = []
  for (let i = 0; i < 5; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    days.push(d)
  }
  return days
}

const DAY_LABELS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'S\u00C1B']

function generateWeekCalendar() {
  const days = getWeekDays()
  const events = []

  days.forEach((date, dayIdx) => {
    const dateStr = date.toISOString().split('T')[0]
    const dayName = DAY_LABELS[date.getDay()]

    const add = [
      { country: 'BR', max: 0.7 },
      { country: 'US', max: 0.9 },
      { country: 'CN', max: 0.3 },
      { country: 'DE', max: 0.2 },
      { country: 'UK', max: 0.2 },
      { country: 'JP', max: 0.15 },
    ]

    add.forEach(({ country, max }) => {
      if (Math.random() < max) {
        const pool = CALENDAR_EVENTS.filter(e => e.country === country)
        if (pool.length) {
          const pick = pool[Math.floor(Math.random() * pool.length)]
          events.push({
            ...pick,
            date: dateStr,
            dayLabel: dayName,
            time: dayIdx === 3 && country === 'US' ? '09:30' : pick.time,
          })
        }
      }
    })
  })

  return events.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
}

/* ─── Mock data ─── */

const MOCK = {
  quote: {
    symbol: 'WINQ26',
    name: 'Ibovespa Mini',
    price: 128765,
    changePercent: 0.42,
    change: 542,
    isMarketOpen: true,
    lastClose: 128223,
    lastUpdated: new Date().toISOString(),
  },
  marketScore: {
    score: 45,
    label: 'MODERADO',
    segment: 1,
    factors: {
      eventsImpact: 15,
      vix: 10,
      gapFutures: 8,
      realizedVol: 12,
    },
  },
  calendar: generateWeekCalendar(),
  news: [
    {
      title: 'Fed mant\u00e9m juros e sinaliza cortes no segundo semestre',
      source: 'Reuters',
      timeAgo: '2h atr\u00e1s',
      url: 'https://news.google.com/search?q=Fed+juros+cortes+2026&hl=pt-BR',
    },
    {
      title: 'Petr\u00f3leo opera em alta com tens\u00f5es geopol\u00edticas no Oriente M\u00e9dio',
      source: 'Bloomberg',
      timeAgo: '3h atr\u00e1s',
      url: 'https://news.google.com/search?q=petr%C3%B3leo+geopol%C3%ADtica+Oriente+M%C3%A9dio&hl=pt-BR',
    },
    {
      title: 'China anuncia pacote de est\u00edmulo fiscal para impulsionar economia',
      source: 'Valor Econ\u00f4mico',
      timeAgo: '4h atr\u00e1s',
      url: 'https://news.google.com/search?q=China+est%C3%ADmulo+fiscal+economia&hl=pt-BR',
    },
  ],
  licenseValidation: {
    valid: false,
    tier: 'free',
    message: 'Chave inv\u00e1lida ou expirada.',
  },
}

/* ─── Sentiment analysis helpers ─── */

const SENTIMENT_BEARISH = ['tens\u00e3o', 'tarifa', 'infla\u00e7\u00e3o', 'corte', 'risco', 'queda', 'desacelera']
const SENTIMENT_BULLISH = ['est\u00edmulo', 'pacote', 'alta', 'crescimento', 'impulsionar', 'acordo', 'recupera']

function computeNewsSentiment(news) {
  let bearishScore = 0
  let bullishScore = 0
  ;(news || []).forEach(n => {
    const t = (n.title || '').toLowerCase()
    SENTIMENT_BEARISH.forEach(k => { if (t.includes(k)) bearishScore++ })
    SENTIMENT_BULLISH.forEach(k => { if (t.includes(k)) bullishScore++ })
  })
  return { bearishScore, bullishScore }
}

/* ─── Dynamic analyst note generator ─── */

function generateAnalystNote(events, news) {
  const lines = []

  const highImpact = (events || []).filter(e => e.impact >= 3)
  if (highImpact.length > 0) {
    lines.push('Alto impacto hoje:')
    highImpact.forEach(e => lines.push(`  ${e.event} (${e.time})`))
    lines.push('N\u00e3o opere 30 min antes e depois de cada evento.')
  }

  const { bearishScore, bullishScore } = computeNewsSentiment(news)

  if (bearishScore > bullishScore) {
    lines.push('Not\u00edcias sugerem cautela no curto prazo.')
  } else if (bullishScore > bearishScore) {
    lines.push('Not\u00edcias com vi\u00e9s positivo hoje.')
  } else {
    lines.push('Not\u00edcias neutras \u2014 sem vi\u00e9s claro.')
  }

  if (highImpact.length > 0) {
    lines.push('Reduza exposi\u00e7\u00e3o ou aguarde confirma\u00e7\u00e3o dos dados.')
  } else {
    lines.push('Opere conforme seu plano \u2014 sem eventos de alto impacto.')
  }

  return lines.join('\n')
}

/* ─── Volatility computation (events + news) ─── */

function computeVolatilitySegment(events, news) {
  let score = 30

  const highImpact = (events || []).filter(e => e.impact >= 3).length
  const medImpact = (events || []).filter(e => e.impact === 2).length
  score += highImpact * 18
  score += medImpact * 4

  const { bearishScore, bullishScore } = computeNewsSentiment(news)
  score += (bearishScore - bullishScore) * 10

  score = Math.max(0, Math.min(100, score))
  const segment = score <= 25 ? 0 : score <= 50 ? 1 : score <= 75 ? 2 : 3

  return { score, segment }
}

const COUNTRY_FLAG = {
  US: '\u{1F1FA}\u{1F1F8}',
  CN: '\u{1F1E8}\u{1F1F3}',
  BR: '\u{1F1E7}\u{1F1F7}',
  DE: '\u{1F1E9}\u{1F1EA}',
  UK: '\u{1F1EC}\u{1F1E7}',
  JP: '\u{1F1EF}\u{1F1F5}',
}

/* ─── B3 asset base list (no hardcoded expiry) ─── */

const ASSET_LIST = [
  { base: 'WIN', name: 'Mini \u00cdndice', category: 'indice_futuro' },
  { base: 'IND', name: '\u00cdndice Futuro (cheio)', category: 'indice_futuro' },
  { base: 'WDO', name: 'Mini D\u00f3lar', category: 'dolar_futuro' },
  { base: 'DOL', name: 'D\u00f3lar Futuro (cheio)', category: 'dolar_futuro' },
]

/* ─── API fetch functions ─── */

async function fetchQuote(symbol) {
  if (USE_MOCK) return { ...MOCK.quote, symbol: symbol || MOCK.quote.symbol }
  const cached = await getCache(`quote_${symbol}`)
  if (cached) return cached
  try {
    const res = await fetch(`${BRAPI_BASE}/quote?symbols=${symbol}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const body = await res.json()
    const q = body.quotes?.[0]
    if (!q) throw new Error('empty response')
    const data = {
      symbol: q.symbol,
      name: q.assetDescription || symbol,
      price: q.close ?? q.settlement,
      changePercent: q.oscillationPct ?? 0,
      change: q.close && q.settlement ? q.close - q.settlement : 0,
      isMarketOpen: !!q.close,
      lastClose: q.settlement || q.close,
      lastUpdated: new Date(q.date * 1000 || Date.now()).toISOString(),
    }
    await setCache(`quote_${symbol}`, data, CACHE_TTL.quote)
    return data
  } catch {
    return { ...MOCK.quote, symbol: symbol || MOCK.quote.symbol }
  }
}

async function fetchCalendar() {
  return [...MOCK.calendar]
}

async function fetchNews() {
  return [...MOCK.news]
}

async function fetchMarketScore() {
  return { ...MOCK.marketScore }
}

async function validateLicense(key) {
  const valid = key === 'FOUNDER-2026'
  return { valid, tier: valid ? 'founder' : 'free', message: valid ? 'Licen\u00e7a ativa.' : 'Chave inv\u00e1lida.' }
}

/* ─── Time helpers ─── */

function formatCacheTime(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export {
  USE_MOCK,
  ASSET_LIST,
  COUNTRY_FLAG,
  CACHE_TTL,
  getCache,
  setCache,
  resolveCurrentContract,
  fetchQuote,
  fetchCalendar,
  fetchNews,
  fetchMarketScore,
  validateLicense,
  formatCacheTime,
  generateAnalystNote,
  computeVolatilitySegment,
}
