import { getCache, setCache, CACHE_CONFIG } from './cache.js'
import { resolveCurrentContract, getResolvedSymbol } from './b3.js'

const API_BASE = 'https://opera-proxy.datamapleai.workers.dev/api/v1'

const SYMBOL_RE = /^[A-Z0-9]{2,12}$/
function isValidSymbol(symbol) {
  return typeof symbol === 'string' && SYMBOL_RE.test(symbol)
}

/* ─── Mock flag (debug only) ───
   Default: false. A extensão sempre tenta o backend real.
   Pra dev local sem backend, setar via console:
     chrome.storage.local.set({ useMock: true }) e recarregar
   Ou clicar no chip "MOCK" no header da extensão.
*/

async function getUseMock() {
  try {
    const r = await chrome.storage.local.get('useMock')
    return !!r.useMock
  } catch { return false }
}

async function setUseMock(v) {
  try { await chrome.storage.local.set({ useMock: !!v }) } catch {}
}

/* ─── Contract resolution ───
   A lógica de B3 (vencimentos + data BRT) vive em b3.js — fonte única.
   Reexportada abaixo para manter compatibilidade dos imports da UI. */

/* ─── Asset list ─── */

const ASSET_LIST = [
  { base: 'WIN', name: 'Mini \u00cdndice', category: 'indice_futuro' },
  { base: 'WDO', name: 'Mini D\u00f3lar', category: 'dolar_futuro' },
]

/* ─── Mock data (fallback only — usar quando backend não responde) ─── */

const MOCK = {
  watchlist: [
    { symbol: 'WINQ26', name: 'Mini \u00cdndice', price: 180515, changePercent: 3.12, lastClose: 175050 },
    { symbol: 'WDON26', name: 'Mini D\u00f3lar', price: 5680, changePercent: -0.45, lastClose: 5705.5 },
  ],
  quote: {
    symbol: 'WINQ26', name: 'Mini \u00cdndice', price: 180515, changePercent: 3.12,
    change: 5465, isMarketOpen: false, lastClose: 175050, lastUpdated: '2026-07-10T21:00:00.000Z',
  },
  termStructures: {
    WIN: [
      { contract: 'WINQ26', iv: 31.8, expiration: '2026-08-12', isCurrent: true },
      { contract: 'WINU26', iv: 29.4, expiration: '2026-09-09', isCurrent: false },
      { contract: 'WINV26', iv: 27.1, expiration: '2026-10-14', isCurrent: false },
      { contract: 'WINX26', iv: 25.8, expiration: '2026-11-11', isCurrent: false },
      { contract: 'WINZ26', iv: 24.2, expiration: '2026-12-09', isCurrent: false },
    ],
    WDO: [
      { contract: 'WDON26', iv: 20.1, expiration: '2026-07-16', isCurrent: true },
      { contract: 'WDOQ26', iv: 19.4, expiration: '2026-08-03', isCurrent: false },
      { contract: 'WDOU26', iv: 18.7, expiration: '2026-09-01', isCurrent: false },
      { contract: 'WDOV26', iv: 18.2, expiration: '2026-10-01', isCurrent: false },
      { contract: 'WDOX26', iv: 17.6, expiration: '2026-11-02', isCurrent: false },
    ],
  },
  macro: {
    selic: 14.25,
    ipca12m: 4.64,
    cdi: 14.15,
    asOf: '2026-07-10',
  },
  ivPercentile: 84,
  news: [
    { title: 'Fed mant\u00e9m juros e sinaliza cortes no segundo semestre', source: 'Reuters', timeAgo: '2h atr\u00e1s', url: '#' },
    { title: 'Petr\u00f3leo opera em alta com tens\u00f5es geopol\u00edticas no Oriente M\u00e9dio', source: 'Bloomberg', timeAgo: '3h atr\u00e1s', url: '#' },
    { title: 'China anuncia pacote de est\u00edmulo fiscal para impulsionar economia', source: 'Valor Econ\u00f4mico', timeAgo: '4h atr\u00e1s', url: '#' },
  ],
  calendarEvents: [
    { event: 'Payroll (EUA)', time: '09:30', impact: 3, country: 'US' },
    { event: 'Taxa Selic (Copom)', time: '18:30', impact: 3, country: 'BR' },
  ],
  license: { valid: false, tier: 'free', message: 'Chave inv\u00e1lida ou expirada.' },
}

/* ─── HTTP wrapper (com fallback mock em runtime) ─── */

async function http(path, opts = {}) {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...opts,
      headers: { 'Accept': 'application/json', ...(opts.headers || {}) },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (e) {
    if (await getUseMock()) {
      return { __mock: true, __error: e.message }
    }
    throw e
  }
}

/* ─── API fetch functions (proxy-backed) ─── */

async function fetchWatchlist(force = false) {
  if (await getUseMock()) return [...MOCK.watchlist]
  const cached = await getCache('watchlist', force)
  if (cached) return cached
  try {
    const data = await http('/watchlist?symbols=WIN,WDO')
    if (data && data.length) await setCache('watchlist', data, CACHE_CONFIG.watchlist.ttl, CACHE_CONFIG.watchlist.afterClose)
    return data || []
  } catch { return [] }
}

async function fetchQuote(symbol, force = false) {
  if (!isValidSymbol(symbol)) return null
  if (await getUseMock()) return { ...MOCK.quote, symbol: symbol || MOCK.quote.symbol }
  const cached = await getCache(`quote_${symbol}`, force)
  if (cached) return cached
  try {
    const data = await http(`/quote?symbol=${encodeURIComponent(symbol)}`)
    if (data) await setCache(`quote_${symbol}`, data, CACHE_CONFIG.quote.ttl, CACHE_CONFIG.quote.afterClose)
    return data
  } catch (e) {
    console.error('fetchQuote error:', e)
    return null
  }
}

async function fetchTermStructure(symbol, force = false) {
  const base = symbol?.match(/^(WIN|WDO)/)?.[1] || 'WIN'
  if (await getUseMock()) {
    const data = MOCK.termStructures[base]
    return data ? data.map(c => ({ ...c })) : []
  }
  const cached = await getCache(`term_${base}`, force)
  if (cached) return cached
  try {
    const data = await http(`/term-structure?symbol=${base}`)
    if (data && data.length) await setCache(`term_${base}`, data, CACHE_CONFIG.term.ttl, CACHE_CONFIG.term.afterClose)
    return data || []
  } catch { return [] }
}

async function fetchIVPercentile(symbol) {
  if (await getUseMock()) return MOCK.ivPercentile
  const base = symbol?.match(/^(WIN|WDO)/)?.[1] || 'WIN'
  const cacheKey = `term_${base}_pct`
  const cached = await getCache(cacheKey)
  if (cached != null) return cached
  try {
    const data = await http(`/term-structure?symbol=${encodeURIComponent(symbol)}&percentile=true`)
    const pct = data?.percentile ?? null
    if (pct != null) await setCache(cacheKey, pct, CACHE_CONFIG.term.ttl, CACHE_CONFIG.term.afterClose)
    return pct
  } catch { return null }
}

async function fetchMacro(force = false) {
  if (await getUseMock()) return { ...MOCK.macro }
  const cached = await getCache('macro', force)
  if (cached) return cached
  try {
    const data = await http('/macro')
    if (data) await setCache('macro', data, CACHE_CONFIG.macro.ttl, CACHE_CONFIG.macro.afterClose)
    return data
  } catch { return null }
}

async function fetchNews(force = false) {
  if (await getUseMock()) return [...MOCK.news]
  const cached = await getCache('news', force)
  if (cached) return cached
  try {
    const data = await http('/news?limit=3')
    if (data && data.length) await setCache('news', data, CACHE_CONFIG.news.ttl, CACHE_CONFIG.news.afterClose)
    return data || []
  } catch { return [] }
}

async function fetchCalendar(force = false) {
  if (await getUseMock()) return [...MOCK.calendarEvents]
  const cached = await getCache('calendar', force)
  if (cached) return cached
  try {
    const data = await http('/calendar')
    if (data) await setCache('calendar', data, CACHE_CONFIG.calendar.ttl, CACHE_CONFIG.calendar.afterClose)
    return data || []
  } catch { return [] }
}

async function validateLicense(key) {
  if (await getUseMock()) {
    return { valid: false, tier: 'free', message: 'Licen\u00e7a indispon\u00edvel no modo mock.' }
  }
  try {
    return await http('/license/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    })
  } catch { return { valid: false, tier: 'free', message: 'Erro de conex\u00e3o.' } }
}

/* ─── Health check (pra UI mostrar chip "MOCK" quando offline) ─── */

async function ping() {
  try {
    const result = await http('/health', { method: 'GET' })
    if (result?.__mock) return { ok: false, mock: true, reason: result.__error }
    return { ok: true, mock: false }
  } catch (e) {
    if (await getUseMock()) return { ok: false, mock: true, reason: e.message }
    return { ok: false, mock: false, reason: e.message }
  }
}

/* ─── Analyst note generator ─── */

function generateAnalystNote(events, ivPercentile) {
  const lines = []
  const highImpact = (events || []).filter(e => e.impact >= 3)
  if (highImpact.length > 0) {
    lines.push('Eventos de alto impacto estimados:')
    highImpact.forEach(e => lines.push(`  ${e.event} (${e.time})`))
    lines.push('Confirme os horários no calendário oficial antes de operar.')
  }
  if (ivPercentile != null) {
    const level = ivPercentile > 80 ? 'alta' : ivPercentile > 50 ? 'moderada' : 'baixa'
    lines.push(`Volatilidade estimada em nível ${level} (referência ${ivPercentile}).`)
  }
  if (highImpact.length === 0) lines.push('Sem eventos de alto impacto estimados para hoje.')
  lines.push('Dados estimados — não constitui recomendação.')
  return lines.join('\n')
}

/* ─── Exports ─── */

export {
  API_BASE,
  ASSET_LIST,
  resolveCurrentContract,
  getResolvedSymbol,
  fetchWatchlist,
  fetchQuote,
  fetchTermStructure,
  fetchIVPercentile,
  fetchMacro,
  fetchNews,
  fetchCalendar,
  validateLicense,
  ping,
  getUseMock,
  setUseMock,
  generateAnalystNote,
}
