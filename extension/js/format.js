/* ─── Formatação e utilitários puros (testáveis) ───
   Usados pelo popup para exibir preços, variações, datas e o próximo evento.
   Nada aqui toca o DOM ou chrome.*.
*/

const BRT = 'America/Sao_Paulo'

export function toNumber(value) {
  if (value == null || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

export function baseOf(symbol) {
  const s = String(symbol || '').toUpperCase()
  const m = s.match(/^(WIN|WDO|IND|DOL)/)
  if (m) return m[1]
  return s.replace(/[^A-Z].*$/, '').replace(/\d+$/, '')
}

export function decimalsFor(base) {
  if (base === 'WIN' || base === 'IND') return 0
  if (base === 'WDO' || base === 'DOL') return 1
  return 2
}

export function priceTypeLabel(type) {
  if (type === 'settlement') return 'Ajuste'
  if (type === 'close') return 'Fechamento'
  return 'Preço de referência'
}

export function formatPrice(value, base) {
  const n = toNumber(value)
  if (n == null) return '—'
  const decimals = decimalsFor(base)
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/* Variação percentual: verde/coral com + / −; zero é neutro. */
export function formatChange(value) {
  const n = toNumber(value)
  if (n == null) return { text: '—', tone: 'flat' }
  if (n === 0) return { text: '0,00%', tone: 'flat' }
  const sign = n > 0 ? '+' : '\u2212'
  const abs = Math.abs(n).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return { text: `${sign}${abs}%`, tone: n > 0 ? 'up' : 'down' }
}

export function formatExpiration(value) {
  if (!value) return ''
  const raw = String(value)
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00Z` : raw)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('pt-BR', {
    timeZone: 'UTC',
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  })
}

/* Data/hora em America/Sao_Paulo.
   - string "YYYY-MM-DD" ou "dd/mm/yyyy" => só data
   - ISO com horário => data + hora
   - nunca inventa hora a partir da hora da consulta */
export function formatDateTime(value, { timeZone = BRT } = {}) {
  if (value == null || value === '') return ''
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [y, m, d] = trimmed.split('-').map(Number)
      return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
    }
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) return trimmed
  }
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('pt-BR', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function eventTimestamp(event) {
  if (!event) return null
  if (event.startsAt) {
    const t = new Date(event.startsAt).getTime()
    return Number.isNaN(t) ? null : t
  }
  if (event.date && event.time) {
    const tz = event.timezone || BRT
    if (tz === BRT) {
      const t = new Date(`${event.date}T${event.time}:00-03:00`).getTime()
      return Number.isNaN(t) ? null : t
    }
  }
  return null
}

/* Primeiro evento futuro, em ordem cronológica.
   Retorna null quando não há data/horário interpretável (não inventa). */
export function pickNextEvent(events, now = new Date()) {
  if (!Array.isArray(events)) return null
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime()
  let best = null
  let bestTs = Infinity
  for (const event of events) {
    const ts = eventTimestamp(event)
    if (ts == null || ts <= nowMs) continue
    if (ts < bestTs) {
      bestTs = ts
      best = event
    }
  }
  return best ? { ...best, _ts: bestTs } : null
}

export function formatEventWhen(event, now = new Date()) {
  const ts = event?._ts ?? eventTimestamp(event)
  if (ts == null) return ''
  const when = new Date(ts)
  const dayKey = (d) => new Intl.DateTimeFormat('en-CA', {
    timeZone: BRT, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d)
  const time = new Intl.DateTimeFormat('pt-BR', {
    timeZone: BRT, hour: '2-digit', minute: '2-digit',
  }).format(when)
  if (dayKey(when) === dayKey(now instanceof Date ? now : new Date(now))) {
    return `Hoje \u00b7 ${time}`
  }
  const day = new Intl.DateTimeFormat('pt-BR', {
    timeZone: BRT, day: '2-digit', month: '2-digit',
  }).format(when)
  return `${day} \u00b7 ${time}`
}

export function isHttpsUrl(value) {
  if (typeof value !== 'string') return false
  try {
    const u = new URL(value)
    return u.protocol === 'https:'
  } catch {
    return false
  }
}
