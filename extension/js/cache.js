import { getLastB3Close } from './b3.js'

const MS_MINUTE = 60 * 1000
const MS_HOUR = 60 * MS_MINUTE
const MS_DAY = 24 * MS_HOUR

/* Fonte de verdade dos TTLs. Preserva a regra de invalidação de fechamento. */
export const CACHE_CONFIG = {
  watchlist: { ttl: MS_HOUR, afterClose: true },
  quote: { ttl: MS_HOUR, afterClose: true },
  term: { ttl: MS_HOUR, afterClose: true },
  macro: { ttl: MS_DAY, afterClose: false },
  news: { ttl: 15 * MS_MINUTE, afterClose: false },
  calendar: { ttl: MS_HOUR, afterClose: false },
}

/* Lê o registro cru, mesmo expirado, para permitir fallback explícito. */
export async function getCacheEntry(key) {
  try {
    const result = await chrome.storage.local.get(key)
    return result[key] || null
  } catch { return null }
}

export function isFresh(entry, now = Date.now()) {
  if (!entry || entry.data == null) return false
  if (typeof entry.timestamp !== 'number') return false
  if (now - entry.timestamp > entry.ttl) return false
  if (entry.invalidateAfterClose && entry.timestamp < getLastB3Close()) return false
  return true
}

/* Compatibilidade: retorna apenas o dado se estiver fresco. */
export async function getCache(key, force = false) {
  const entry = await getCacheEntry(key)
  if (!entry) return null
  if (force) return null
  return isFresh(entry) ? entry.data : null
}

/* Grava o dado com o instante da consulta (não renova validade em falha). */
export async function setCache(key, data, ttl, invalidateAfterClose = false) {
  try {
    await chrome.storage.local.set({
      [key]: { data, timestamp: Date.now(), ttl, invalidateAfterClose },
    })
  } catch {}
}
