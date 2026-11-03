import test from 'node:test'
import assert from 'node:assert/strict'
import {
  baseOf, decimalsFor, priceTypeLabel,
  formatPrice, formatChange, formatExpiration, formatDateTime,
  pickNextEvent, formatEventWhen, isHttpsUrl,
} from '../extension/js/format.js'

test('baseOf identifica o ativo do contrato', () => {
  assert.equal(baseOf('WINQ26'), 'WIN')
  assert.equal(baseOf('WDOU26'), 'WDO')
  assert.equal(baseOf('INDZ25'), 'IND')
  assert.equal(baseOf('PETR4'), 'PETR')
})

test('decimalsFor: índice inteiro, dólar 1 casa, ação 2', () => {
  assert.equal(decimalsFor('WIN'), 0)
  assert.equal(decimalsFor('WDO'), 1)
  assert.equal(decimalsFor('PETR'), 2)
})

test('priceTypeLabel cobre settlement, close e legado', () => {
  assert.equal(priceTypeLabel('settlement'), 'Ajuste')
  assert.equal(priceTypeLabel('close'), 'Fechamento')
  assert.equal(priceTypeLabel(undefined), 'Preço de referência')
})

test('formatPrice usa pt-BR e precisão por instrumento', () => {
  assert.equal(formatPrice(180515, 'WIN'), '180.515')
  assert.equal(formatPrice(5680.5, 'WDO'), '5.680,5')
  assert.equal(formatPrice(null, 'WIN'), '—')
  assert.equal(formatPrice('abc', 'WIN'), '—')
})

test('formatChange: zero neutro, positivo +, negativo −', () => {
  assert.deepEqual(formatChange(0), { text: '0,00%', tone: 'flat' })
  assert.deepEqual(formatChange(1.234), { text: '+1,23%', tone: 'up' })
  assert.deepEqual(formatChange(-0.45), { text: '−0,45%', tone: 'down' })
  assert.deepEqual(formatChange(null), { text: '—', tone: 'flat' })
  assert.deepEqual(formatChange('x'), { text: '—', tone: 'flat' })
})

test('formatDateTime: data pura sem hora; ISO com hora em BRT', () => {
  assert.equal(formatDateTime('2026-07-10'), '10/07/2026')
  assert.equal(formatDateTime('10/07/2026'), '10/07/2026')
  // 21:00Z == 18:00 BRT
  const s = formatDateTime('2026-07-10T21:00:00.000Z')
  assert.match(s, /10\/07\/2026/)
  assert.match(s, /18:00/)
  assert.equal(formatDateTime(null), '')
  assert.equal(formatDateTime('nope'), '')
})

test('formatExpiration usa dd/mm/aa', () => {
  assert.equal(formatExpiration('2026-08-12'), '12/08/26')
  assert.equal(formatExpiration(''), '')
})

test('pickNextEvent escolhe o primeiro futuro e ignora sem data/fuso', () => {
  const now = new Date('2026-07-10T12:00:00-03:00')
  const events = [
    { event: 'Passado', startsAt: '2026-07-10T09:30:00-03:00' },
    { event: 'Sem data', time: '10:00' },
    { event: 'Futuro 2', startsAt: '2026-07-12T09:00:00-03:00' },
    { event: 'Futuro 1', startsAt: '2026-07-10T18:30:00-03:00' },
  ]
  const next = pickNextEvent(events, now)
  assert.equal(next.event, 'Futuro 1')
})

test('pickNextEvent aceita date+time+timezone e retorna null sem dados', () => {
  const now = new Date('2026-07-10T12:00:00-03:00')
  const next = pickNextEvent([
    { event: 'Copom', date: '2026-07-10', time: '15:00', timezone: 'America/Sao_Paulo' },
  ], now)
  assert.equal(next.event, 'Copom')
  assert.equal(pickNextEvent([{ event: 'x', time: '09:00' }], now), null)
  assert.equal(pickNextEvent(null, now), null)
})

test('formatEventWhen marca hoje e datas futuras', () => {
  const now = new Date('2026-07-10T12:00:00-03:00')
  assert.match(formatEventWhen({ _ts: new Date('2026-07-10T18:30:00-03:00').getTime() }, now), /Hoje · 18:30/)
  assert.match(formatEventWhen({ _ts: new Date('2026-07-12T09:00:00-03:00').getTime() }, now), /12\/07 · 09:00/)
})

test('isHttpsUrl só aceita https válido', () => {
  assert.equal(isHttpsUrl('https://exemplo.com/a'), true)
  assert.equal(isHttpsUrl('http://exemplo.com'), false)
  assert.equal(isHttpsUrl('#'), false)
  assert.equal(isHttpsUrl('javascript:alert(1)'), false)
  assert.equal(isHttpsUrl(null), false)
})
