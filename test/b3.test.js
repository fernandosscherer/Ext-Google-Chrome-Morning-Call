import test from 'node:test'
import assert from 'node:assert/strict'
import {
  resolveCurrentContract,
  getWinExpirationDay,
  getFirstBusinessDay,
  getLastB3Close,
  getResolvedSymbol,
} from '../extension/js/b3.js'

/* Helper: BRT calendar date -> Date at local midnight (what b3 uses). */
function refDate(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(y, m - 1, d)
}

test('WIN in a non-expiry month rolls to the next even month', () => {
  // Jul/2026 (month index 6) is not a WIN expiry month -> Aug (Q).
  assert.equal(resolveCurrentContract('WIN', refDate('2026-07-01')), 'WINQ26')
})

test('WIN stays on current contract before expiry day', () => {
  // Aug/2026 is a WIN expiry month; day 10 is before the Wednesday closest to 15.
  const expDay = getWinExpirationDay(2026, 7)
  assert.ok(expDay >= 11 && expDay <= 19)
  assert.equal(resolveCurrentContract('WIN', refDate('2026-08-10')), 'WINQ26')
})

test('WIN rolls to next even month after expiry day', () => {
  // Day 20 is always after the expiry day (max 19).
  assert.equal(resolveCurrentContract('WIN', refDate('2026-08-20')), 'WINV26')
})

test('WIN December rollover advances the year', () => {
  // Dec/2026 (index 11) is an expiry month; after expiry -> Feb/2027 (G27).
  assert.equal(resolveCurrentContract('WIN', refDate('2026-12-31')), 'WING27')
})

test('WDO rolls on the first business day of the month', () => {
  // Mar/2026 starts on Sunday, so first business day is Mar 2 (Mon).
  assert.equal(getFirstBusinessDay(2026, 2), 2)
  // Day 1 is before the first business day -> stays in March (H).
  assert.equal(resolveCurrentContract('WDO', refDate('2026-03-01')), 'WDOH26')
  // Day 2 onwards -> next month (J).
  assert.equal(resolveCurrentContract('WDO', refDate('2026-03-02')), 'WDOJ26')
})

test('getResolvedSymbol keeps stocks as the base ticker', () => {
  assert.equal(getResolvedSymbol({ base: 'PETR4', category: 'stock' }), 'PETR4')
})

test('getLastB3Close: before 18:30 BRT returns previous weekday close', () => {
  // Wed 2026-03-04 12:00 BRT -> Tue 2026-03-03 18:30 BRT (21:30 UTC).
  const now = new Date('2026-03-04T12:00:00-03:00')
  assert.equal(getLastB3Close(now), Date.UTC(2026, 2, 3, 21, 30))
})

test('getLastB3Close: after 18:30 BRT returns same day close', () => {
  // Wed 2026-03-04 20:00 BRT -> Wed close (21:30 UTC same day).
  const now = new Date('2026-03-04T20:00:00-03:00')
  assert.equal(getLastB3Close(now), Date.UTC(2026, 2, 4, 21, 30))
})

test('getLastB3Close: weekends fall back to Friday', () => {
  // Sun 2026-03-08 10:00 BRT -> Fri 2026-03-06 18:30 BRT.
  const now = new Date('2026-03-08T10:00:00-03:00')
  assert.equal(getLastB3Close(now), Date.UTC(2026, 2, 6, 21, 30))
})
