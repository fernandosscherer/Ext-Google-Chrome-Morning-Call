/* ─── B3 contract resolution + BRT date helpers ───
   Fonte única para a extensão. Usado por api.js e cache.js.
   Mantém a resolução de contratos futuros (WIN/IND e WDO/DOL) e o
   cálculo do último fechamento da B3 (18:30 BRT), sempre em America/Sao_Paulo.
*/

const MONTH_CODES = ['F','G','H','J','K','M','N','Q','U','V','X','Z']

export function getBrtParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false,
  })
  const parts = {}
  for (const { type, value } of formatter.formatToParts(date)) {
    parts[type] = parseInt(value, 10)
  }
  return parts
}

export function getBrtDate(date = new Date()) {
  const p = getBrtParts(date)
  return new Date(p.year, p.month - 1, p.day)
}

export function getWinExpirationDay(year, monthIndex) {
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

export function getFirstBusinessDay(year, monthIndex) {
  for (let d = 1; d <= 7; d++) {
    const dt = new Date(Date.UTC(year, monthIndex, d))
    const dayOfWeek = dt.getUTCDay()
    if (dayOfWeek >= 1 && dayOfWeek <= 5) return d
  }
  return 1
}

export function resolveCurrentContract(baseSymbol, refDate = getBrtDate()) {
  const y = refDate.getFullYear()
  const m = refDate.getMonth()
  const d = refDate.getDate()
  const isWin = ['WIN', 'IND'].includes(baseSymbol)

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
    return `${baseSymbol}${MONTH_CODES[targetMonth]}${targetYear % 100}`
  }

  const firstBiz = getFirstBusinessDay(y, m)
  let targetMonth = m
  let targetYear = y
  if (d >= firstBiz) {
    targetMonth = (m + 1) % 12
    if (targetMonth <= m) targetYear++
  }
  return `${baseSymbol}${MONTH_CODES[targetMonth]}${targetYear % 100}`
}

export function getResolvedSymbol(asset, refDate) {
  if (asset.category === 'stock') return asset.base
  return resolveCurrentContract(asset.base, refDate)
}

/* Último fechamento da B3 (18:30 BRT) que já ocorreu, pulando fins de semana.
   18:30 BRT == 21:30 UTC. Retorna epoch em ms. */
export function getLastB3Close(now = new Date()) {
  const p = getBrtParts(now)
  const closeMs = (y, mo, da) => Date.UTC(y, mo, da, 21, 30)

  let cursor = new Date(Date.UTC(p.year, p.month - 1, p.day))
  if (now.getTime() < closeMs(p.year, p.month - 1, p.day)) {
    cursor = new Date(cursor.getTime() - 86400000)
  }

  while (cursor.getUTCDay() === 0 || cursor.getUTCDay() === 6) {
    cursor = new Date(cursor.getTime() - 86400000)
  }

  return closeMs(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate())
}
