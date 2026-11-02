const now = new Date()
const formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric', month: 'numeric', day: 'numeric'
})
const parts = formatter.formatToParts(now)
console.log(parts)
const p = {}
parts.forEach(({type, value}) => p[type] = parseInt(value, 10))
console.log(p)
console.log(new Date(p.year, p.month - 1, p.day))
