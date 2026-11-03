import { getCacheEntry, isFresh, setCache, CACHE_CONFIG } from './cache.js'
import { resolveCurrentContract } from './b3.js'

const API_BASE = 'https://opera-proxy.datamapleai.workers.dev/api/v1'

const SYMBOL_RE = /^[A-Z0-9]{2,12}$/
function isValidSymbol(symbol) {
  return typeof symbol === 'string' && SYMBOL_RE.test(symbol)
}

/* ─── Mock flag (debug only) ─── */
async function getUseMock() {
  try {
    const r = await chrome.storage.local.get('useMock')
    return !!r.useMock
  } catch { return false }
}

async function setUseMock(v) {
  try { await chrome.storage.local.set({ useMock: !!v }) } catch {}
}

/* ─── Asset list ─── */
const ASSET_LIST = [
  { base: 'WIN', name: 'Mini \u00cdndice', category: 'indice_futuro' },
  { base: 'WDO', name: 'Mini D\u00f3lar', category: 'dolar_futuro' },
]

/* ─── Mock data (fallback only) ───
   Estrutura alinhada com o que o backend real retorna (priceType, lastUpdated, series, startsAt). */
const MOCK = {
  watchlist: [
    { symbol: 'WINQ26', name: 'Mini \u00cdndice', price: 180515, priceType: 'settlement', changePercent: 3.12, lastClose: 175050, lastUpdated: '2026-07-10T21:00:00.000Z', isMarketOpen: false },
    { symbol: 'WDON26', name: 'Mini D\u00f3lar', price: 5680.5, priceType: 'settlement', changePercent: -0.45, lastClose: 5705.5, lastUpdated: '2026-07-10T21:00:00.000Z', isMarketOpen: false },
  ],
  quote: {
    symbol: 'WINQ26', name: 'Mini \u00cdndice', price: 180515, priceType: 'settlement', changePercent: 3.12,
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
    series: {
      selic: { value: 14.25, date: '2026-07-10' },
      ipca12m: { value: 4.64, date: '2026-07-10' },
      cdi: { value: 14.15, date: '2026-07-10' },
    },
    asOf: '2026-07-10',
    selic: 14.25,
    ipca12m: 4.64,
    cdi: 14.15,
  },
  ivPercentile: 84,
  news: [
    { title: 'Fed mant\u00e9m juros e sinaliza cortes no segundo semestre', source: 'Reuters', timeAgo: '2h atr\u00e1s', url: '#' },
    { title: 'Petr\u00f3leo opera em alta com tens\u00f5es geopol\u00edticas no Oriente M\u00e9dio', source: 'Bloomberg', timeAgo: '3h atr\u00e1s', url: '#' },
    { title: 'China anuncia pacote de est\u00edmulo fiscal para impulsionar economia', source: 'Valor Econ\u00f4mico', timeAgo: '4h atr\u00e1s', url: '#' },
  ],
  calendarEvents: [
    { event: 'Payroll (EUA)', time: '09:30', impact: 3, country: 'US', estimated: true, date: '2026-07-10', startsAt: '2026-07-10T09:30:00-03:00', timezone: 'America/Sao_Paulo' },
    { event: 'Taxa Selic (Copom)', time: '18:30', impact: 3, country: 'BR', estimated: true, date: '2026-07-10', startsAt: '2026-07-10T18:30:00-03:00', timezone: 'America/Sao_Paulo' },
  ],
  license: { valid: false, tier: 'free', message: 'Chave inv\u00e1lida ou expirada.' },
}

/* ─── HTTP wrapper (sem fallback mock silencioso) ─── */
async function httpJson(path, opts = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: { 'Accept': 'application/json', ...(opts.headers || {}) },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

/* Construtor de resultado padronizado */
function result(status, data, fetchedAt, error = null, demo = false) {
  return { status, data, fetchedAt, error, demo }
}

const isEmptyArray = d => Array.isArray(d) && d.length === 0
const isEmpty = d => d == null

async function loadResource({ cacheKey, path, cfg, force = false, demoData = undefined, isEmpty: emptyCheck = isEmpty }) {
  const useMock = await getUseMock()
  if (useMock && demoData !== undefined) {
    const data = typeof demoData === 'function' ? demoData() : demoData
    return result(emptyCheck(data) ? 'empty' : 'ok', data, Date.now(), null, true)
  }

  const entry = await getCacheEntry(cacheKey)
  if (!force && isFresh(entry)) {
    return result(emptyCheck(entry.data) ? 'empty' : 'cached', entry.data, entry.timestamp, null, false)
  }

  try {
    const data = await httpJson(path)
    await setCache(cacheKey, data, cfg.ttl, cfg.afterClose)
    return result(emptyCheck(data) ? 'empty' : 'ok', data, Date.now(), null, false)
  } catch (e) {
    if (entry && entry.data != null) {
      return result('stale', entry.data, entry.timestamp, e.message, false)
    }
    return result('error', null, null, e.message, false)
  }
}

/* ─── API fetch functions ─── */

export async function fetchWatchlist(force = false) {
  return loadResource({
    cacheKey: 'watchlist',
    path: '/watchlist?symbols=WIN,WDO',
    cfg: CACHE_CONFIG.watchlist,
    force,
    demoData: () => MOCK.watchlist.map(x => ({ ...x })),
    isEmpty: isEmptyArray,
  })
}

export async function fetchQuote(symbol, force = false) {
  if (!isValidSymbol(symbol)) return result('error', null, null, 'S\u00edmbolo inv\u00e1lido', false)
  return loadResource({
    cacheKey: `quote_${symbol}`,
    path: `/quote?symbol=${encodeURIComponent(symbol)}`,
    cfg: CACHE_CONFIG.quote,
    force,
    demoData: () => ({ ...MOCK.quote, symbol: symbol || MOCK.quote.symbol }),
    isEmpty: isEmpty,
  })
}

export async function fetchTermStructure(base, force = false) {
  const b = (base || 'WIN').match(/^(WIN|WDO)/)?.[1] || 'WIN'
  return loadResource({
    cacheKey: `term_${b}`,
    path: `/term-structure?symbol=${b}`,
    cfg: CACHE_CONFIG.term,
    force,
    demoData: () => MOCK.termStructures[b].map(x => ({ ...x })),
    isEmpty: isEmptyArray,
  })
}

export async function fetchIVPercentile(symbol) {
  if (await getUseMock()) return MOCK.ivPercentile
  const base = symbol?.match(/^(WIN|WDO)/)?.[1] || 'WIN'
  const cacheKey = `term_${base}_pct`
  const entry = await getCacheEntry(cacheKey)
  if (entry && isFresh(entry)) return entry.data
  try {
    const data = await httpJson(`/term-structure?symbol=${encodeURIComponent(symbol)}&percentile=true`)
    const pct = data?.percentile ?? null
    if (pct != null) await setCache(cacheKey, pct, CACHE_CONFIG.term.ttl, CACHE_CONFIG.term.afterClose)
    return pct
  } catch { return null }
}

export async function fetchMacro(force = false) {
  return loadResource({
    cacheKey: 'macro',
    path: '/macro',
    cfg: CACHE_CONFIG.macro,
    force,
    demoData: () => ({ ...MOCK.macro }),
    isEmpty: isEmpty,
  })
}

export async function fetchNews(force = false) {
  return loadResource({
    cacheKey: 'news',
    path: '/news?limit=3',
    cfg: CACHE_CONFIG.news,
    force,
    demoData: () => [...MOCK.news],
    isEmpty: isEmptyArray,
  })
}

export async function fetchCalendar(force = false) {
  return loadResource({
    cacheKey: 'calendar',
    path: '/calendar',
    cfg: CACHE_CONFIG.calendar,
    force,
    demoData: () => [...MOCK.calendarEvents],
    isEmpty: isEmptyArray,
  })
}

export async function validateLicense(key) {
  if (await getUseMock()) {
    return { valid: false, tier: 'free', message: 'Licen\u00e7a indispon\u00edvel no modo mock.' }
  }
  try {
    return await httpJson('/license/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    })
  } catch { return { valid: false, tier: 'free', message: 'Erro de conex\u00e3o.' } }
}

export async function ping() {
  try {
    await httpJson('/health')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

/* ─── Exports ───
   As funções de fetch/ping/validate já usam `export` inline. */
export {
  API_BASE,
  ASSET_LIST,
  resolveCurrentContract,
  getUseMock,
  setUseMock,
}