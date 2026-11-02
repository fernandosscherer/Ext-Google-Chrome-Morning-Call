import { getLastB3Close } from './b3.js'

const MS_MINUTE = 60 * 1000
const MS_HOUR = 60 * MS_MINUTE
const MS_DAY = 24 * MS_HOUR

export const CACHE_CONFIG = {
  watchlist: { ttl: MS_HOUR, afterClose: true },
  quote: { ttl: MS_HOUR, afterClose: true },
  term: { ttl: MS_HOUR, afterClose: true },
  macro: { ttl: MS_DAY, afterClose: false },
  news: { ttl: 15 * MS_MINUTE, afterClose: false },
  calendar: { ttl: MS_HOUR, afterClose: false },
}

export async function getCache(key, force = false) {
  try {
    const result = await chrome.storage.local.get(key)
    const entry = result[key]
    if (!entry || !entry.data) return null
    if (force) return null
    if (Date.now() - entry.timestamp > entry.ttl) return null
    if (entry.invalidateAfterClose && entry.timestamp < getLastB3Close()) return null
    return entry.data
  } catch { return null }
}

export async function setCache(key, data, ttl, invalidateAfterClose = false) {
  try {
    await chrome.storage.local.set({
      [key]: { data, timestamp: Date.now(), ttl, invalidateAfterClose },
    })
  } catch {}
}
