const now = new Date()
const formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric', month: 'numeric', day: 'numeric'
})
const parts = formatter.formatToParts(now)
const p = {}
parts.forEach(({type, value}) => p[type] = parseInt(value, 10))

const brtDateStr = `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}T18:30:00-03:00`
const target = new Date(brtDateStr)
console.log("brtDateStr:", brtDateStr)
console.log("target:", target)
