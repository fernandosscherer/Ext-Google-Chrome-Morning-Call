const BRAPI_BASE = 'https://brapi.dev/api/v2/futures'
const CACHE_TTL = { quote: 60 * 1000 }

async function getCache(key) {
  try {
    const result = await chrome.storage.local.get(key)
    const entry = result[key]
    if (!entry || !entry.data) return null
    if (Date.now() - entry.timestamp > entry.ttl) return null
    return entry.data
  } catch { return null }
}

async function setCache(key, data, ttl) {
  try {
    await chrome.storage.local.set({ [key]: { data, timestamp: Date.now(), ttl } })
  } catch {}
}

const SYMBOLS = ['WIN', 'WDO', 'IND', 'DOL']

function resolveContract(base) {
  const codes = ['F','G','H','J','K','M','N','Q','U','V','X','Z']
  const winMonths = ['G','J','M','Q','V','Z']
  const now = new Date()
  const m = now.getMonth()
  const y = now.getFullYear() % 100
  const valid = ['WIN', 'IND'].includes(base) ? winMonths : codes
  let t = m
  for (let i = 0; i < 12; i++) {
    const mi = (m + i) % 12
    if (valid.includes(codes[mi])) { t = mi; break }
  }
  const yr = t < m ? y + 1 : y
  return `${base}${codes[t]}${yr}`
}

async function refreshQuotes() {
  const contracts = SYMBOLS.map(resolveContract).join(',')
  try {
    const res = await fetch(`${BRAPI_BASE}/quote?symbols=${contracts}`)
    if (!res.ok) return
    const body = await res.json()
    if (!body.quotes) return
    for (const q of body.quotes) {
      const data = {
        symbol: q.symbol,
        name: q.assetDescription || q.symbol,
        price: q.close ?? q.settlement,
        changePercent: q.oscillationPct ?? 0,
        change: q.close && q.settlement ? q.close - q.settlement : 0,
        isMarketOpen: !!q.close,
        lastClose: q.settlement || q.close,
        lastUpdated: new Date(q.date * 1000 || Date.now()).toISOString(),
      }
      await setCache(`quote_${q.symbol}`, data, CACHE_TTL.quote)
    }
  } catch {}
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('refresh', { periodInMinutes: 5 })
  refreshQuotes()
})

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'refresh') refreshQuotes()
})
