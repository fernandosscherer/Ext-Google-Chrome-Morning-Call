import {
  ASSET_LIST,
  fetchWatchlist, fetchQuote, fetchTermStructure,
  fetchMacro, fetchNews, fetchCalendar,
  validateLicense, ping, getUseMock, setUseMock,
  resolveCurrentContract,
} from './api.js'
import {
  baseOf,
  formatPrice, formatChange, formatExpiration, formatDateTime,
  formatEventWhen, pickNextEvent, priceTypeLabel, isHttpsUrl,
} from './format.js'

/* ─── Escaping (dados externos sempre como texto) ─── */
function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/* ─── Ícones (Lucide, stroke 1.5) ─── */
const S = (d, w = 18, h = 18) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`

const Icon = {
  Sun: S('<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>'),
  Moon: S('<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>'),
  Settings: S('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>'),
  Star: S('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>', 16, 16),
  StarFilled: S('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="currentColor"/>', 16, 16),
  Refresh: S('<path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>'),
  ArrowLeft: S('<path d="m15 18-6-6 6-6"/>', 18, 18),
  ChevronRight: S('<path d="m9 18 6-6-6-6"/>', 16, 16),
  Alert: S('<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>', 15, 15),
}

const LogoSvg = `<img class="header__logo-img" src="icons/logo-morningcall.png" width="38" height="38" alt="" aria-hidden="true">`

/* ─── TradingView Calendar ─── */
function getCalendarUrl(theme) {
  const s = {
    colorTheme: theme,
    isTransparent: true,
    width: '100%',
    height: 360,
    importanceFilter: '0,1',
    countryFilter: 'br,us',
  }
  const url = new URL('https://www.tradingview-widget.com/embed-widget/events/')
  url.searchParams.set('locale', 'br')
  url.hash = encodeURIComponent(JSON.stringify(s))
  return url.toString()
}

function buildCalendarIframe() {
  const iframe = document.createElement('iframe')
  iframe.id = 'tv-calendar'
  iframe.className = 'calendar-iframe'
  iframe.src = getCalendarUrl(state.theme)
  iframe.setAttribute('frameborder', '0')
  iframe.setAttribute('scrolling', 'no')
  iframe.setAttribute('loading', 'lazy')
  iframe.title = 'Calend\u00e1rio econ\u00f4mico (TradingView)'
  return iframe
}

/* ─── State ─── */
const state = {
  view: 'main',
  theme: 'dark',
  useMock: false,
  backend: { ok: true, checked: false, error: null },
  booting: true,
  refreshing: false,
  selectedSymbol: '',
  favorites: [],
  licenseTier: 'free',
  licenseKey: '',
  data: {
    watchlist: null,
    calendar: null,
    macro: null,
    termWIN: null,
    termWDO: null,
    news: null,
    quote: null,
  },
}

let refreshSeq = 0
let detailSeq = 0
let renderScheduled = false
let searchTimer = 0

/* ─── Render ─── */
function scheduleRender() {
  if (renderScheduled) return
  renderScheduled = true
  requestAnimationFrame(() => {
    renderScheduled = false
    render()
  })
}

function render() {
  const app = document.getElementById('app')
  if (!app) return

  const scrollY = window.scrollY || document.documentElement.scrollTop || 0
  const searchInput = document.querySelector('[data-search-input]')
  const searchIsFocused = document.activeElement === searchInput
  const searchValue = searchInput ? searchInput.value : state.selectedSymbol
  const dd = document.querySelector('[data-search-dropdown]')
  const ddWasOpen = dd ? dd.classList.contains('search__dropdown--open') : false
  const licenseInput = document.querySelector('[data-license-input]')
  const licenseIsFocused = document.activeElement === licenseInput

  const frame = document.getElementById('tv-calendar')
  const keepFrame = frame && frame.src === getCalendarUrl(state.theme)
  const savedFrame = keepFrame ? frame : null
  if (savedFrame) savedFrame.remove()

  app.innerHTML = state.view === 'settings' ? renderSettings() : renderMain()
  mountCalendar(savedFrame)
  restoreSearch(searchValue, searchIsFocused, ddWasOpen)
  if (licenseIsFocused) {
    const input = document.querySelector('[data-license-input]')
    if (input) {
      input.focus()
      const n = input.value.length
      try { input.setSelectionRange(n, n) } catch {}
    }
  }
  window.scrollTo(0, scrollY)
}

function mountCalendar(savedFrame) {
  const mount = document.querySelector('[data-calendar-mount]')
  if (!mount) return
  mount.appendChild(savedFrame || buildCalendarIframe())
}

function restoreSearch(value, focused, open) {
  const input = document.querySelector('[data-search-input]')
  if (!input) return
  if (value != null) input.value = value
  if (focused) {
    input.focus()
    const n = input.value.length
    try { input.setSelectionRange(n, n) } catch {}
  }
  if (open && input.value) applySearchFilter(input.value)
}

/* ─── Header ─── */
function renderHeader() {
  const busy = state.booting || state.refreshing
  let chip = ''
  if (state.useMock) {
    chip = `<button class="status-chip status-chip--demo" data-action="toggle-demo" title="Modo demonstra\u00e7\u00e3o ativo. Clique para voltar aos dados reais.">DEMO</button>`
  } else if (state.backend.checked && !state.backend.ok) {
    chip = `<span class="status-chip status-chip--offline" title="Worker indispon\u00edvel${state.backend.error ? `: ${esc(state.backend.error)}` : ''}">OFFLINE</span>`
  }
  return `
    <header class="header">
      <div class="header__brand">
        <div class="header__logo">${LogoSvg}</div>
        <div class="header__titles">
          <h1 class="header__title">Opera Morning Call</h1>
          <p class="header__subtitle">Pr\u00e9-abertura B3</p>
        </div>
      </div>
      <div class="header__actions">
        ${chip}
        <button class="icon-btn ${state.theme === 'dark' ? '' : 'icon-btn--active'}" data-action="toggle-theme" aria-label="Alternar tema" title="Alternar tema">
          ${state.theme === 'dark' ? Icon.Sun : Icon.Moon}
        </button>
        <button class="icon-btn" data-action="refresh" aria-label="Atualizar dados" title="Atualizar" ${busy ? 'disabled' : ''}>
          ${busy ? '<span class="spinner" aria-hidden="true"></span>' : Icon.Refresh}
        </button>
        <button class="icon-btn" data-action="open-settings" aria-label="Configura\u00e7\u00f5es" title="Configura\u00e7\u00f5es">
          ${Icon.Settings}
        </button>
      </div>
    </header>
  `
}

/* ─── Pairs (WIN / WDO) ─── */
function assetName(base) {
  return ASSET_LIST.find(a => a.base === base)?.name || base
}

function currentPair(base) {
  const res = state.data.watchlist
  if (!res) return { kind: 'loading' }
  if (res.status === 'error') return { kind: 'error', res }
  const list = Array.isArray(res.data) ? res.data : []
  const item = list.find(q => baseOf(q.symbol) === base)
  if (!item) return { kind: 'empty', res }
  return { kind: 'ok', res, item }
}

function renderPairs() {
  return `<div class="pairs">${renderPair('WIN')}${renderPair('WDO')}</div>`
}

function renderPair(base) {
  const name = assetName(base)
  const p = currentPair(base)

  if (p.kind === 'loading') {
    return `<div class="skeleton skeleton--pair" role="status" aria-label="Carregando ${esc(base)}"></div>`
  }

  if (p.kind === 'error' || p.kind === 'empty') {
    const desc = p.kind === 'error' ? 'Falha ao carregar' : 'Sem cota\u00e7\u00e3o'
    return `
      <button class="pair pair--error" data-action="retry-watchlist" aria-label="${esc(base)} indispon\u00edvel. Tentar novamente">
        <span class="pair__ticker">${esc(base)}</span>
        <span class="pair__error-title">Indispon\u00edvel</span>
        <span class="pair__error-desc">${esc(desc)} \u00b7 tentar novamente</span>
      </button>
    `
  }

  const { res, item } = p
  const change = formatChange(item.changePercent)
  const price = item.price ?? item.lastClose
  const type = priceTypeLabel(item.priceType)
  const asOf = formatDateTime(item.lastUpdated)
  const stale = res.status === 'stale'
  const prevClose = item.lastClose != null && item.lastClose !== price
    ? `<span class="pair__prev">Fech. anterior ${formatPrice(item.lastClose, base)}</span>`
    : ''
  const statusText = stale
    ? `<span class="pair__meta">${asOf ? esc(asOf) + ' \u00b7 ' : ''}<span class="muted">Desatualizado</span></span>`
    : `<span class="pair__meta">${asOf ? esc(asOf) : '&nbsp;'}</span>`

  return `
    <button class="pair" data-action="select-symbol" data-symbol="${esc(item.symbol)}"
            aria-label="${esc(base)} ${esc(name)}, contrato ${esc(item.symbol)}, pre\u00e7o ${esc(formatPrice(price, base))}, varia\u00e7\u00e3o ${esc(change.text)}">
      <span class="pair__top">
        <span class="pair__name">${esc(base)} \u00b7 ${esc(name)}</span>
        <span class="pair__ticker">${esc(item.symbol)}</span>
      </span>
      <span class="pair__price">${esc(formatPrice(price, base))}</span>
      <span class="pair__row">
        <span class="pair__type">${esc(type)}</span>
        <span class="pair__change pair__change--${change.tone}">${esc(change.text)}</span>
      </span>
      ${prevClose}
      ${statusText}
    </button>
  `
}

/* ─── Agenda ─── */
function statusBadge(res) {
  if (!res) return ''
  if (res.demo) return `<span class="block-badge block-badge--demo">DEMO</span>`
  if (res.status === 'stale') return `<span class="block-badge block-badge--stale">Desatualizado</span>`
  if (res.status === 'error') return `<span class="block-badge block-badge--error">Indispon\u00edvel</span>`
  return ''
}

function impactDots(impact) {
  const n = Math.max(0, Math.min(3, Number(impact) || 0))
  const dots = [1, 2, 3].map(i =>
    `<span class="impact__dot ${i <= n ? 'impact__dot--on' : ''}"></span>`
  ).join('')
  return `<span class="impact" role="img" aria-label="Impacto ${n} de 3">${dots}</span>`
}

function renderAgenda() {
  const res = state.data.calendar
  let summary = ''

  if (!res) {
    summary = `<div class="skeleton skeleton--line" role="status" aria-label="Carregando agenda"></div>`
  } else if (res.status === 'error') {
    summary = `
      <div class="errorline">
        <span>Agenda resumida indispon\u00edvel.</span>
        <button class="retry" data-action="retry-calendar">Tentar novamente</button>
      </div>`
  } else {
    const events = Array.isArray(res.data) ? res.data : []
    const next = pickNextEvent(events, new Date())
    if (next) {
      const when = formatEventWhen(next, new Date())
      const stale = res.status === 'stale'
      summary = `
        <div class="next">
          <div class="next__when">
            <span class="next__day">Pr\u00f3ximo</span>
            <span class="next__time">${esc(when || '\u2014')}</span>
          </div>
          <div class="next__body">
            <span class="next__name">${esc(next.event || 'Evento')}</span>
            <span class="next__tags">
              ${impactDots(next.impact)}
              ${next.country ? `<span>${esc(next.country)}</span>` : ''}
              ${next.estimated ? '<span class="tag-est">Estimado</span>' : ''}
              ${stale ? '<span class="tag-est">Desatualizado</span>' : ''}
            </span>
          </div>
        </div>`
    } else {
      const suffix = res.status === 'stale' ? ' (dados salvos)' : ''
      summary = `<p class="empty">Sem eventos futuros na agenda consultada${esc(suffix)}.</p>`
    }
  }

  return `
    <section class="section" aria-labelledby="agenda-title">
      <div class="section__head">
        <span class="section__title" id="agenda-title">Agenda econ\u00f4mica</span>
        ${statusBadge(res)}
      </div>
      ${summary}
      <div class="calendar" data-calendar-mount></div>
    </section>
  `
}

/* ─── Macro ─── */
function renderMacro() {
  const res = state.data.macro
  const head = `
    <div class="section__head">
      <span class="section__title">Indicadores macro</span>
      <span class="section__meta">BCB/SGS</span>
      ${statusBadge(res)}
    </div>`

  if (!res) {
    return `<section class="section">${head}<div class="skeleton skeleton--line" role="status" aria-label="Carregando indicadores"></div></section>`
  }

  const payload = res.data && typeof res.data === 'object' ? res.data : {}
  const series = payload.series && typeof payload.series === 'object' ? payload.series : null
  const commonDate = payload.asOf || null
  const defs = [
    { key: 'selic', label: 'Selic', unit: '% a.a.' },
    { key: 'ipca12m', label: 'IPCA 12m', unit: '%' },
    { key: 'cdi', label: 'CDI', unit: '% a.a.' },
  ]

  const items = defs.map(d => {
    const entry = series && series[d.key] != null ? series[d.key] : null
    const value = entry && typeof entry === 'object' ? entry.value : (payload[d.key] ?? (entry == null ? null : entry))
    const date = entry && typeof entry === 'object' ? entry.date : null
    const num = Number(value)
    const valid = value != null && value !== '' && Number.isFinite(num)
    const shown = valid
      ? `<span class="macro__value">${num.toFixed(2)}<small>${esc(d.unit)}</small></span>`
      : `<span class="macro__value">\u2014</span>`
    const dateLine = !commonDate && date
      ? `<span class="macro__date">${esc(formatDateTime(date))}</span>`
      : ''
    return `<div class="macro__item">
      <span class="macro__label">${esc(d.label)}</span>
      ${shown}
      ${dateLine}
    </div>`
  }).join('')

  const errorLine = res.status === 'error'
    ? `<div class="errorline"><span>Indicadores indispon\u00edveis.</span><button class="retry" data-action="retry-macro">Tentar novamente</button></div>`
    : ''

  return `
    <section class="section">
      ${head}
      <div class="macro">${items}</div>
      ${commonDate ? `<p class="section__meta" style="margin-left:0">Refer\u00eancia: ${esc(formatDateTime(commonDate))}</p>` : ''}
      ${errorLine}
    </section>
  `
}

/* ─── Term structure ─── */
function termGroups() {
  const groups = []
  const defs = [
    { base: 'WIN', res: state.data.termWIN },
    { base: 'WDO', res: state.data.termWDO },
  ]
  for (const { base, res } of defs) {
    const arr = res && Array.isArray(res.data) ? res.data.filter(Boolean) : []
    if (arr.length === 0) continue
    const sorted = [...arr].sort((a, b) => {
      const ta = a.expiration ? new Date(a.expiration).getTime() : Infinity
      const tb = b.expiration ? new Date(b.expiration).getTime() : Infinity
      return ta - tb
    })
    groups.push({ base, res, contracts: sorted })
  }
  return groups
}

function currentContractFor(base) {
  const res = base === 'WIN' ? state.data.termWIN : state.data.termWDO
  const arr = res && Array.isArray(res.data) ? res.data : []
  const expected = resolveCurrentContract(base)
  if (arr.some(t => t.contract === expected)) return expected
  return (arr.find(t => t.isCurrent) || {}).contract || expected
}

function renderTerm() {
  const groups = termGroups()
  const head = `
    <div class="section__head">
      <span class="section__title">Vencimentos</span>
      ${statusBadge(state.data.termWIN) || statusBadge(state.data.termWDO)}
    </div>`

  if (groups.length === 0) {
    const failing = state.data.termWIN?.status === 'error' && state.data.termWDO?.status === 'error'
    if (state.data.termWIN || state.data.termWDO) {
      return `
        <section class="section">
          ${head}
          <div class="errorline">
            <span>Vencimentos indispon\u00edveis.</span>
            <button class="retry" data-action="retry-term">Tentar novamente</button>
          </div>
        </section>`
    }
    return `<section class="section">${head}<div class="skeleton skeleton--line" role="status" aria-label="Carregando vencimentos"></div></section>`
  }

  const blocks = groups.map(({ base, res, contracts }) => {
    const current = currentContractFor(base)
    const expected = resolveCurrentContract(base)
    if (!contracts.some(t => t.contract === expected)) {
      // Não cria regra ad hoc: apenas registra a divergência para investigação.
      console.warn(`[OMC] contrato vigente divergente em ${base}: esperado ${expected}`)
    }
    const currentRow = contracts.find(t => t.contract === current)
    const vol = currentRow && Number.isFinite(Number(currentRow.iv))
      ? `<span class="term__vol">Vol. est. <b>${Number(currentRow.iv).toFixed(1)}%</b></span>`
      : ''

    const rows = contracts.map(t => {
      const isCurrent = t.contract === current
      const isSelected = t.contract === state.selectedSymbol
      return `
        <button class="term__row ${isCurrent ? 'term__row--current' : ''} ${isSelected ? 'term__row--selected' : ''}"
                data-action="select-symbol" data-symbol="${esc(t.contract)}"
                aria-label="${esc(t.contract)}, vencimento ${esc(formatExpiration(t.expiration) || 'desconhecido')}${isCurrent ? ', contrato vigente' : ''}">
          <span class="term__ticker">${esc(t.contract)}</span>
          ${isCurrent ? '<span class="term__flag">Vigente</span>' : ''}
          ${isSelected && !isCurrent ? '<span class="term__flag term__flag--sel">Selecionado</span>' : ''}
          <span class="term__exp">${esc(formatExpiration(t.expiration) || '\u2014')}</span>
        </button>`
    }).join('')

    return `
      <div class="term__group">
        <div class="term__group-head">
          <span class="term__group-title">${esc(base)} \u00b7 ${esc(assetName(base))}</span>
          ${vol}
        </div>
        ${rows}
      </div>`
  }).join('')

  return `<section class="section">${head}<div class="term">${blocks}</div></section>`
}

/* ─── Search ─── */
function searchOptions() {
  const seen = new Set()
  const options = []
  for (const group of termGroups()) {
    for (const t of group.contracts) {
      if (seen.has(t.contract)) continue
      seen.add(t.contract)
      options.push({ symbol: t.contract, base: group.base, expiration: t.expiration })
    }
  }
  if (options.length === 0) {
    for (const asset of ASSET_LIST) {
      const symbol = resolveCurrentContract(asset.base)
      if (seen.has(symbol)) continue
      seen.add(symbol)
      options.push({ symbol, base: asset.base, expiration: null })
    }
  }
  return options
}

function renderSearch() {
  const value = state.selectedSymbol || resolveCurrentContract('WIN')
  const options = searchOptions()
  return `
    <div class="section">
      <div class="section__head"><span class="section__title">Buscar contrato</span></div>
      <div class="search" data-component="search">
        <input class="search__input" type="text" placeholder="Ex.: WINQ26, WDOQ26"
          data-search-input value="${esc(value)}" autocomplete="off" spellcheck="false"
          aria-label="Buscar contrato" />
        <div class="search__dropdown" data-search-dropdown role="listbox">
          ${options.map(o => `
            <button class="search__option ${o.symbol === state.selectedSymbol ? 'search__option--active' : ''}"
                    role="option" data-symbol="${esc(o.symbol)}" data-action="select-symbol">
              <span class="search__option-symbol">${esc(o.symbol)}</span>
              <span class="search__option-name">${esc(assetName(o.base))}</span>
              <span class="search__option-exp">${esc(formatExpiration(o.expiration) || '')}</span>
            </button>
          `).join('')}
        </div>
      </div>
    </div>
  `
}

function applySearchFilter(raw) {
  const q = (raw || '').trim().toUpperCase()
  document.querySelectorAll('[data-search-dropdown] [data-symbol]').forEach(el => {
    const sym = (el.dataset.symbol || '').toUpperCase()
    const name = (el.querySelector('.search__option-name')?.textContent || '').toUpperCase()
    el.style.display = sym.includes(q) || name.includes(q) ? '' : 'none'
  })
  const dd = document.querySelector('[data-search-dropdown]')
  if (dd) dd.classList.toggle('search__dropdown--open', q.length > 0)
}

/* ─── Favorites ─── */
function renderFavorites() {
  if (!state.favorites || state.favorites.length === 0) return ''
  return `
    <div class="section">
      <div class="section__head"><span class="section__title">Favoritos</span></div>
      <div class="chips">
        ${state.favorites.map(sym => `
          <button class="chip ${sym === state.selectedSymbol ? 'chip--active' : ''}"
                  data-action="select-symbol" data-symbol="${esc(sym)}">${esc(sym)}</button>
        `).join('')}
      </div>
    </div>
  `
}

/* ─── Detail ─── */
function termEntryFor(symbol) {
  for (const group of termGroups()) {
    const found = group.contracts.find(t => t.contract === symbol)
    if (found) return { base: group.base, entry: found }
  }
  return { base: baseOf(symbol), entry: null }
}

function renderDetail() {
  const sym = state.selectedSymbol
  if (!sym) return ''

  const res = state.data.quote
  const { base, entry } = termEntryFor(sym)
  const isFav = state.favorites.includes(sym)
  const header = `
    <div class="detail__head">
      <div class="detail__id">
        <span class="detail__symbol">${esc(sym)}</span>
        <span class="detail__name">${esc(assetName(base))}</span>
      </div>
      <button class="detail__fav" data-action="toggle-favorite" data-symbol="${esc(sym)}"
              aria-label="${isFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}"
              title="${isFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}">
        ${isFav ? Icon.StarFilled : Icon.Star}
      </button>
    </div>`

  let body = ''
  if (!res) {
    body = `<div class="skeleton skeleton--line" role="status" aria-label="Carregando cota\u00e7\u00e3o"></div>`
  } else if (res.status === 'error') {
    body = `<div class="errorline"><span>Cota\u00e7\u00e3o indispon\u00edvel.</span><button class="retry" data-action="retry-quote">Tentar novamente</button></div>`
  } else {
    const d = res.data || {}
    const change = formatChange(d.changePercent)
    const price = d.price ?? d.lastClose
    const asOf = formatDateTime(d.lastUpdated)
    const vol = entry && Number.isFinite(Number(entry.iv)) ? `${Number(entry.iv).toFixed(1)}%` : null
    const exp = entry?.expiration ? formatExpiration(entry.expiration) : null
    body = `
      <div class="detail__grid">
        <span class="detail__price">${esc(formatPrice(price, base))}</span>
        <span class="detail__change detail__change--${change.tone}">${esc(change.text)}</span>
        <span class="detail__type">${esc(priceTypeLabel(d.priceType))}</span>
      </div>
      <div class="detail__meta">
        ${asOf ? `Atualizado em ${esc(asOf)}` : 'Hor\u00e1rio n\u00e3o informado'}
        ${res.status === 'stale' ? ' \u00b7 Desatualizado' : ''}
        ${exp ? ` \u00b7 Vence ${esc(exp)}` : ''}
        ${vol ? ` \u00b7 Vol. est. ${esc(vol)}` : ''}
      </div>`
  }

  return `<section class="section"><div class="detail">${header}${body}</div></section>`
}

/* ─── News ─── */
function renderNews() {
  const res = state.data.news
  const head = `
    <div class="section__head">
      <span class="section__title">Mercado hoje</span>
      ${statusBadge(res)}
    </div>`

  if (!res) {
    return `<section class="section">${head}<div class="skeleton skeleton--line" role="status" aria-label="Carregando not\u00edcias"></div></section>`
  }
  if (res.status === 'error') {
    return `<section class="section">${head}<div class="errorline"><span>Not\u00edcias indispon\u00edveis.</span><button class="retry" data-action="retry-news">Tentar novamente</button></div></section>`
  }
  const items = Array.isArray(res.data) ? res.data.slice(0, 3) : []
  if (items.length === 0) {
    return `<section class="section">${head}<p class="empty">Sem manchetes no momento.</p></section>`
  }
  const list = items.map(n => {
    const meta = [n.source, n.timeAgo || formatDateTime(n.publishedAt)].filter(Boolean).map(esc).join(' \u00b7 ')
    const title = `<span class="news-item__title">${esc(n.title || 'Sem t\u00edtulo')}</span>`
    const inner = `${title}<span class="news-item__meta">${meta || 'Fonte n\u00e3o informada'}</span>`
    if (isHttpsUrl(n.url)) {
      return `<button class="news-item" data-action="open-news" data-url="${esc(n.url)}">${inner}</button>`
    }
    return `<div class="news-item">${inner}</div>`
  }).join('')
  return `<section class="section">${head}<div class="news">${list}</div></section>`
}

/* ─── CTA + footer ─── */
function renderCTA() {
  return `
    <div class="cta">
      <button class="cta__btn" data-action="open-platform">
        Conhecer o Opera Trader ${Icon.ChevronRight}
      </button>
    </div>`
}

function renderFooter() {
  const mode = state.useMock ? 'Dados ilustrativos' : 'Uso informativo'
  return `
    <footer class="footer">
      <span class="footer__brand">${esc(mode)}</span>
      <p class="footer__note">Conte\u00fado informativo e educacional. N\u00e3o constitui recomenda\u00e7\u00e3o, oferta ou consultoria de investimentos.</p>
    </footer>`
}

function renderMain() {
  return `
    ${renderHeader()}
    ${renderPairs()}
    ${renderAgenda()}
    ${renderMacro()}
    ${renderTerm()}
    ${renderSearch()}
    ${renderFavorites()}
    ${renderDetail()}
    ${renderNews()}
    ${renderCTA()}
    ${renderFooter()}
  `
}

/* ─── Settings ─── */
function tierBadge(tier) {
  const map = {
    free: { label: 'Free', cls: 'badge--free' },
    founder: { label: 'Founder Member', cls: 'badge--founder' },
    pro: { label: 'Pro', cls: 'badge--pro' },
  }
  const m = map[tier] || map.free
  return `<span class="badge ${m.cls}">${m.label}</span>`
}

function renderSettings() {
  return `
    <div class="settings">
      <div class="settings__header">
        <button class="settings__back" data-action="back" aria-label="Voltar" title="Voltar">${Icon.ArrowLeft}</button>
        <h2 class="settings__title">Configura\u00e7\u00f5es</h2>
      </div>

      <div class="settings__section">
        <span class="settings__label">Tema</span>
        <button class="settings__btn" data-action="toggle-theme">
          <span>${state.theme === 'dark' ? 'Escuro' : 'Claro'}</span>
          <span class="muted">${state.theme === 'dark' ? Icon.Sun : Icon.Moon}</span>
        </button>
      </div>

      <div class="settings__section">
        <span class="settings__label">Dados</span>
        <button class="settings__btn" data-action="toggle-demo">
          <span>Modo demonstra\u00e7\u00e3o (DEMO)</span>
          <span>${state.useMock ? 'Ativado' : 'Desativado'}</span>
        </button>
        <p class="settings__note">No modo DEMO os dados s\u00e3o ilustrativos e n\u00e3o consultam o Worker.</p>
      </div>

      <div class="settings__section">
        <span class="settings__label">Licen\u00e7a</span>
        <div class="settings__row">
          <input class="settings__input" type="text" placeholder="Chave de licen\u00e7a"
            data-license-input value="${esc(state.licenseKey)}" aria-label="Chave de licen\u00e7a" />
          <button class="settings__validate" data-action="validate-license">Validar</button>
        </div>
        <div class="settings__row" style="align-items:center">
          <span class="settings__note">Status:</span>
          ${tierBadge(state.licenseTier)}
        </div>
        <p class="settings__note">O selo \u00e9 informativo e n\u00e3o altera os dados exibidos.</p>
      </div>

      <div class="settings__section">
        <span class="settings__label">Favoritos (${state.favorites.length}/5)</span>
        ${state.favorites.length === 0
          ? '<p class="settings__empty">Nenhum favorito ainda.</p>'
          : state.favorites.map(sym => `
              <div class="settings__fav-row">
                <span class="settings__fav-symbol">${esc(sym)}</span>
                <button class="settings__fav-remove" data-action="remove-favorite" data-symbol="${esc(sym)}">Remover</button>
              </div>
            `).join('')
        }
      </div>
    </div>
  `
}

/* ─── Data loading ─── */
async function loadAll({ force = false } = {}) {
  const seq = ++refreshSeq
  state.useMock = await getUseMock()
  if (force) state.refreshing = true
  scheduleRender()

  const [health, watchlist, calendar, macro, termWIN, termWDO, news] = await Promise.all([
    ping(),
    fetchWatchlist(force),
    fetchCalendar(force),
    fetchMacro(force),
    fetchTermStructure('WIN', force),
    fetchTermStructure('WDO', force),
    fetchNews(force),
  ])
  if (seq !== refreshSeq) return

  state.backend = { ok: health.ok, checked: true, error: health.error || null }
  state.data.watchlist = watchlist
  state.data.calendar = calendar
  state.data.macro = macro
  state.data.termWIN = termWIN
  state.data.termWDO = termWDO
  state.data.news = news
  state.booting = false
  state.refreshing = false

  reconcileSelection()
  scheduleRender()
  loadDetail(state.selectedSymbol, { force })
}

function reconcileSelection() {
  const available = []
  for (const group of termGroups()) {
    for (const t of group.contracts) available.push(t.contract)
  }
  let sym = state.selectedSymbol
  if (!sym) {
    sym = currentContractFor('WIN')
  } else if (available.length > 0 && !available.includes(sym)) {
    const base = baseOf(sym)
    if (base === 'WIN' || base === 'WDO') sym = currentContractFor(base)
  }
  state.selectedSymbol = sym
}

async function loadDetail(symbol, { force = false } = {}) {
  if (!symbol) return
  const seq = ++detailSeq
  if (!state.data.quote || state.data.quote?.data?.symbol !== symbol) {
    state.data.quote = null
    scheduleRender()
  }
  const res = await fetchQuote(symbol, force)
  if (seq !== detailSeq) return
  state.data.quote = res
  scheduleRender()
}

/* ─── Per-block retries (só a consulta correspondente) ─── */
async function retryWatchlist() {
  const res = await fetchWatchlist(true)
  state.data.watchlist = res
  reconcileSelection()
  scheduleRender()
}
async function retryCalendar() {
  state.data.calendar = await fetchCalendar(true)
  scheduleRender()
}
async function retryMacro() {
  state.data.macro = await fetchMacro(true)
  scheduleRender()
}
async function retryTerm() {
  const [w, d] = await Promise.all([fetchTermStructure('WIN', true), fetchTermStructure('WDO', true)])
  state.data.termWIN = w
  state.data.termWDO = d
  reconcileSelection()
  scheduleRender()
}
async function retryNews() {
  state.data.news = await fetchNews(true)
  scheduleRender()
}
async function retryQuote() {
  if (state.selectedSymbol) await loadDetail(state.selectedSymbol, { force: true })
}

/* ─── Interactions ─── */
function selectSymbol(symbol) {
  if (!symbol) return
  state.selectedSymbol = symbol
  state.data.quote = null
  document.querySelector('[data-search-dropdown]')?.classList.remove('search__dropdown--open')
  loadDetail(symbol, { force: false })
  render()
}

async function toggleDemo() {
  const next = !state.useMock
  await setUseMock(next)
  state.useMock = next
  /* Isola dados reais de simulados */
  state.data = { watchlist: null, calendar: null, macro: null, termWIN: null, termWDO: null, news: null, quote: null }
  state.booting = true
  await loadAll({ force: true })
}

function openUrl(url) {
  if (!isHttpsUrl(url)) return
  chrome.tabs.create({ url }).catch(() => window.open(url, '_blank', 'noopener'))
}

function bindEvents() {
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-action]')
    if (!t) return
    const action = t.dataset.action

    if (action === 'toggle-theme') {
      state.theme = state.theme === 'dark' ? 'light' : 'dark'
      document.documentElement.setAttribute('data-theme', state.theme)
      chrome.storage.sync.set({ theme: state.theme }).catch(() => {})
      render()
      return
    }
    if (action === 'refresh') {
      if (state.refreshing || state.booting) return
      loadAll({ force: true })
      return
    }
    if (action === 'open-settings') { state.view = 'settings'; render(); return }
    if (action === 'back') { state.view = 'main'; render(); return }
    if (action === 'toggle-demo') { toggleDemo(); return }
    if (action === 'select-symbol') {
      const sym = t.dataset.symbol
      const input = document.querySelector('[data-search-input]')
      if (input) input.value = sym
      selectSymbol(sym)
      return
    }
    if (action === 'retry-watchlist') { retryWatchlist(); return }
    if (action === 'retry-calendar') { retryCalendar(); return }
    if (action === 'retry-macro') { retryMacro(); return }
    if (action === 'retry-term') { retryTerm(); return }
    if (action === 'retry-news') { retryNews(); return }
    if (action === 'retry-quote') { retryQuote(); return }
    if (action === 'toggle-favorite') {
      const sym = t.dataset.symbol
      if (!sym) return
      const idx = state.favorites.indexOf(sym)
      if (idx >= 0) state.favorites.splice(idx, 1)
      else if (state.favorites.length < 5) state.favorites.push(sym)
      chrome.storage.sync.set({ favorites: state.favorites }).catch(() => {})
      render()
      return
    }
    if (action === 'remove-favorite') {
      state.favorites = state.favorites.filter(s => s !== t.dataset.symbol)
      chrome.storage.sync.set({ favorites: state.favorites }).catch(() => {})
      render()
      return
    }
    if (action === 'validate-license') {
      const input = document.querySelector('[data-license-input]')
      if (!input) return
      const key = input.value.trim()
      state.licenseKey = key
      validateLicense(key).then(result => {
        state.licenseTier = result.tier || 'free'
        chrome.storage.sync.set({ licenseKey: key, licenseTier: state.licenseTier }).catch(() => {})
        render()
      })
      return
    }
    if (action === 'open-platform') {
      openUrl('https://www.operatrader.com.br/?utm_source=extension&utm_medium=cta&utm_campaign=morning_call')
      return
    }
    if (action === 'open-news') {
      openUrl(t.dataset.url)
      return
    }
  })

  let inputValue = ''
  document.addEventListener('input', (e) => {
    const input = e.target.closest('[data-search-input]')
    if (!input) return
    inputValue = input.value
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => applySearchFilter(inputValue), 90)
  })

  document.addEventListener('keydown', (e) => {
    const input = e.target.closest('[data-search-input]')
    if (!input || e.key !== 'Enter') return
    const val = input.value.trim().toUpperCase()
    if (!val) return
    const visible = document.querySelector('[data-search-dropdown] [data-symbol]:not([style*="display: none"])')
    if (visible) {
      selectSymbol(visible.dataset.symbol)
    } else if (/^[A-Z0-9]{2,12}$/.test(val)) {
      selectSymbol(val)
    }
  })

  document.addEventListener('focusin', (e) => {
    const input = e.target.closest('[data-search-input]')
    if (!input) return
    const dd = document.querySelector('[data-search-dropdown]')
    if (dd && input.value.length > 0) dd.classList.add('search__dropdown--open')
  })

  document.addEventListener('keydown', (e) => {
    if (!e.target.closest('[data-license-input]')) return
    if (e.key === 'Enter') document.querySelector('[data-action="validate-license"]')?.click()
  })

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelector('[data-search-dropdown]')?.classList.remove('search__dropdown--open')
    }
  })
}

/* ─── Init ─── */
async function init() {
  try {
    const prefs = await chrome.storage.sync.get(['theme', 'licenseTier', 'licenseKey', 'favorites'])
    if (prefs.theme) state.theme = prefs.theme
    if (prefs.licenseTier) state.licenseTier = prefs.licenseTier
    if (prefs.licenseKey) state.licenseKey = prefs.licenseKey
    if (Array.isArray(prefs.favorites)) state.favorites = prefs.favorites
  } catch {}

  state.useMock = await getUseMock()
  state.selectedSymbol = resolveCurrentContract('WIN')

  document.documentElement.setAttribute('data-theme', state.theme)
  bindEvents()

  window.addEventListener('message', (e) => {
    if (e.origin !== 'https://www.tradingview-widget.com') return
    const frame = document.getElementById('tv-calendar')
    if (!frame || e.source !== frame.contentWindow) return
    if (e.data?.name === 'tv-widget-resize-iframe') {
      if (e.data.data?.width) frame.style.width = e.data.data.width + 'px'
      if (e.data.data?.height) frame.style.height = e.data.data.height + 'px'
    }
  })

  await loadAll({ force: false })
}

document.addEventListener('DOMContentLoaded', init)
