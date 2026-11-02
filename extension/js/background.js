import { getCache, setCache, CACHE_CONFIG } from './cache.js'

const API_BASE = 'https://opera-proxy.datamapleai.workers.dev/api/v1'
const ALARM_NAME = 'refresh'

async function getUseMock() {
  try {
    const r = await chrome.storage.local.get('useMock')
    return !!r.useMock
  } catch { return false }
}

async function fetchAndCache(endpoint, cacheKey, cfg) {
  if (await getUseMock()) return null
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      headers: { 'Accept': 'application/json' },
    })
    if (!res.ok) return null
    const data = await res.json()
    await setCache(cacheKey, data, cfg.ttl, cfg.afterClose)
    return data
  } catch { return null }
}

async function refreshDailyData() {
  await fetchAndCache('/watchlist?symbols=WIN,WDO', 'watchlist', CACHE_CONFIG.watchlist)
  await fetchAndCache('/macro', 'macro', CACHE_CONFIG.macro)
}

function ensureAlarm() {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: 60 })
}

chrome.runtime.onInstalled.addListener(() => {
  ensureAlarm()
  refreshDailyData()
})

chrome.runtime.onStartup.addListener(() => {
  ensureAlarm()
  refreshDailyData()
})

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) refreshDailyData()
})
