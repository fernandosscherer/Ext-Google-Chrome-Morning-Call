import {
  USE_MOCK, ASSET_LIST, COUNTRY_FLAG,
  fetchQuote, fetchCalendar, fetchNews, validateLicense, formatCacheTime,
  resolveCurrentContract, generateAnalystNote, computeVolatilitySegment,
} from './api.js'

/* ─── Icons (Lucide, stroke 1.5) ─── */

const S = (d, w = 18, h = 18) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`

const Icon = {
  Sun: S('<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>'),
  Moon: S('<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>'),
  Settings: S('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>'),
  Star: S('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>', 18, 18),
  StarFilled: S('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="currentColor"/>', 18, 18),
  ChevronRight: S('<path d="m9 18 6-6-6-6"/>', 16, 16),
  ArrowLeft: S('<path d="m15 18-6-6 6-6"/>', 18, 18),
  AlertCircle: S('<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>', 16, 16),
}

/* ─── Logo SVG (Relógio + Café) ─── */

const LogoSvg = `
<svg class="header__logo-svg" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <path d="M144 32a80 80 0 1 0 0 160 80 80 0 0 0 0-160Zm0 130a50 50 0 1 1 0-100 50 50 0 0 1 0 100Z" fill="currentColor"/>
  <path d="M144 62v42l30 20" stroke="var(--color-bronze)" stroke-width="14" stroke-linecap="round" fill="none"/>
  <path d="M228 30q0 26 20 40t20 40q0 26-20 40" stroke="currentColor" stroke-width="16" stroke-linecap="round" fill="none"/>
  <path d="M298 30q0 26 20 40t20 40q0 26-20 40" stroke="currentColor" stroke-width="16" stroke-linecap="round" fill="none"/>
  <path d="M368 30q0 26 20 40t20 40q0 26-20 40" stroke="currentColor" stroke-width="16" stroke-linecap="round" fill="none"/>
  <path d="M78 208h306a12 12 0 0 1 12 12v168a86 86 0 0 1-86 86H152a86 86 0 0 1-86-86V220a12 12 0 0 1 12-12Z"
        class="cup-body" stroke="currentColor" stroke-width="16"/>
  <path d="M396 250h56a44 44 0 0 1 44 44v40a76 76 0 0 1-76 76h-24" fill="none" stroke="currentColor" stroke-width="16"/>
  <circle cx="330" cy="290" r="9" fill="var(--color-bronze)"/>
  <rect x="322" y="320" width="16" height="60" rx="8" fill="var(--color-bronze)"/>
  <path d="M40 442h380a10 10 0 0 1 10 10 62 62 0 0 1-62 62H92a62 62 0 0 1-62-62 10 10 0 0 1 10-10Z" fill="currentColor"/>
</svg>`

/* ─── Bull icon (calendar impact) ─── */

function BullIcon(active) {
  const color = active ? 'currentColor' : 'var(--color-border)'
  return `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M7.5 6.5C5.5 6.5 3.5 5 3 3.5c-.3 3 .8 5.3 3.4 6.2"/>
    <path d="M16.5 6.5c2 0 4-1.5 4.5-3 .3 3-.8 5.3-3.4 6.2"/>
    <path d="M6.4 9.7a6 6 0 0 1 11.2 0c.5 2.8-.7 5-2.1 7.2a4.3 4.3 0 0 1-7 0C7.1 14.7 5.9 12.5 6.4 9.7Z"/>
    <path d="M10 16.5h.01M14 16.5h.01"/>
  </svg>`
}

/* ─── State ─── */

const state = {
  view: 'main',
  theme: 'dark',
  loading: true,
  error: null,
  cacheTime: null,
  asset: null,
  volatility: null,
  events: null,
  news: null,
  analystNote: '',
  selectedSymbol: '',
  licenseTier: 'free',
  licenseKey: '',
  favorites: [],
  calendarCountries: ['BR', 'US'],
  calendarWeekdays: [],
}

/* ─── Render ─── */

function render() {
  const app = document.getElementById('app')
  if (!app) return

  if (state.view === 'settings') {
    app.innerHTML = renderSettings()
  } else if (state.loading) {
    app.innerHTML = renderLoading()
  } else {
    app.innerHTML = `
      ${renderHeader()}
      ${renderCalendar()}
      ${renderInsights()}
      ${renderSearch()}
      ${state.error ? renderError() : renderAssetCard()}
      ${state.error ? '' : renderVolatility()}
      ${state.error ? '' : renderAnalystCard()}
      ${renderCTA()}
      ${renderDisclaimer()}
    `
  }
}

/* ─── Component renders ─── */

function renderHeader() {
  return `
    <header class="header">
      <div class="header__brand">
        <div class="header__logo">${LogoSvg}</div>
        <div class="header__titles">
          <h1 class="header__title">Opera Morning Call</h1>
          <p class="header__subtitle">Seu checklist de pr\u00e9-abertura.</p>
        </div>
      </div>
      <div class="header__actions">
        <button class="header__btn" data-action="toggle-theme" title="Alternar tema">
          ${state.theme === 'dark' ? Icon.Sun : Icon.Moon}
        </button>
        <button class="header__btn" data-action="open-settings" title="Configura\u00e7\u00f5es">
          ${Icon.Settings}
        </button>
      </div>
    </header>
  `
}

/* ─── calendar helpers ─── */

const ALL_COUNTRIES = ['BR', 'US']

function renderCalendar() {
  const ev = state.events
  const hasEvents = ev && ev.length > 0
  const activeCountries = state.calendarCountries
  const activeWeekdays = state.calendarWeekdays

  const filtered = hasEvents
    ? ev.filter(e => {
        if (!activeCountries.includes(e.country)) return false
        if (e.dayLabel) {
          const dayIdx = DAY_INDEX[e.dayLabel]
          if (activeWeekdays.length && dayIdx !== undefined && !activeWeekdays.includes(dayIdx)) return false
        }
        return true
      })
    : []

  const grouped = {}
  filtered.forEach(e => {
    const key = e.date || 'unknown'
    if (!grouped[key]) grouped[key] = { label: e.dayLabel || '', date: key, events: [] }
    grouped[key].events.push(e)
  })

  const sortedKeys = Object.keys(grouped).sort()

  const allWeekdays = [...new Set((hasEvents ? ev : []).map(e => e.dayLabel).filter(Boolean))].sort(
    (a, b) => (DAY_INDEX[a] ?? 99) - (DAY_INDEX[b] ?? 99)
  )

  return `
    <div class="card-section">
      <div class="section-title">Calend\u00e1rio Econ\u00f4mico</div>

      <div class="cal-filters">
        ${ALL_COUNTRIES.map(code => {
          const flag = COUNTRY_FLAG[code] || code
          const active = activeCountries.includes(code)
          return `<button class="cal-filters__chip ${active ? 'cal-filters__chip--active' : ''}"
            data-cal-filter="country:${code}">${flag}</button>`
        }).join('')}
      </div>

      ${allWeekdays.length > 0 ? `
      <div class="cal-filters">
        ${allWeekdays.map(label => {
          const dayIdx = DAY_INDEX[label]
          const active = !activeWeekdays.length || activeWeekdays.includes(dayIdx)
          return `<button class="cal-filters__chip cal-filters__chip--text ${active ? 'cal-filters__chip--active' : ''}"
            data-cal-filter="weekday:${dayIdx}">${label}</button>`
        }).join('')}
      </div>` : ''}

      ${!hasEvents
        ? '<p class="empty-state">Nenhum evento de alto impacto nesta semana.</p>'
        : sortedKeys.length === 0
          ? '<p class="empty-state">Nenhum evento para os filtros selecionados.</p>'
          : sortedKeys.map(key => {
              const day = grouped[key]
              return `
                <div class="cal-day">
                  <span class="cal-day__label">${day.label} ${day.date.slice(5)}</span>
                  ${day.events.map(e => {
                    const flag = COUNTRY_FLAG[e.country] || e.country
                    return `
                      <div class="calendar-event">
                        <span class="calendar-event__flag">${flag}</span>
                        <div class="calendar-event__info">
                          <span class="calendar-event__name">${e.event}</span>
                          <span class="calendar-event__time">${e.time}</span>
                        </div>
                        <span class="calendar-event__impact">${renderBulls(e.impact)}</span>
                      </div>
                    `
                  }).join('')}
                </div>
              `
            }).join('')
      }
    </div>
  `
}

const DAY_INDEX = { DOM: 0, SEG: 1, TER: 2, QUA: 3, QUI: 4, SEX: 5, S\u00C1B: 6 }

function renderBulls(impact) {
  const bulls = []
  const impactColor = impact >= 3 ? 'var(--color-danger)' : 'var(--color-warning)'
  for (let i = 0; i < 3; i++) {
    const active = i < impact
    bulls.push(`<span style="color:${active ? impactColor : 'var(--color-border)'}">${BullIcon(active)}</span>`)
  }
  return `<span class="calendar-event__bulls">${bulls.join('')}</span>`
}

function renderInsights() {
  const news = state.news
  if (!news || news.length === 0) return ''

  return `
    <div class="card-section">
      <div class="section-title">Mercado Hoje</div>
      ${news.map(n => `
        <a class="insight-item" href="${n.url || '#'}" target="_blank" rel="noopener">
          <p class="insight-item__title">${n.title}</p>
          <span class="insight-item__time">${n.source || 'Opera Trader'} \u00B7 ${n.timeAgo}</span>
        </a>
      `).join('')}
    </div>
  `
}

function renderSearch() {
  const resolved = state.selectedSymbol || resolveCurrentContract('WIN')
  return `
    <div class="search" data-component="search">
      <input class="search__input" type="text" placeholder="Buscar ativo \u2014 ex: WIN, WDO"
        data-search-input value="${resolved}" autocomplete="off" spellcheck="false" />
      <div class="search__dropdown" data-search-dropdown>
        ${ASSET_LIST.map(a => {
          const sym = resolveCurrentContract(a.base)
          return `
            <div class="search__option ${sym === state.selectedSymbol ? 'search__option--active' : ''}"
                 data-symbol="${sym}" data-base="${a.base}">
              <span class="search__option-symbol">${sym}</span>
              <span class="search__option-name">${a.name}</span>
            </div>
          `
        }).join('')}
      </div>
    </div>
  `
}

function renderAssetCard() {
  const a = state.asset
  if (!a) return ''
  const isUp = a.changePercent >= 0
  const changeClass = isUp ? 'up' : 'down'
  const changeSign = isUp ? '+' : ''
  const priceStr = a.price.toLocaleString('pt-BR')
  const isFav = state.favorites.includes(a.symbol)

  return `
    <div class="asset-card">
      <div class="asset-card__header">
        <div class="asset-card__info">
          <div class="asset-card__symbol-row">
            <span class="asset-card__symbol">${a.symbol}</span>
            ${!a.isMarketOpen ? '<span class="asset-card__badge-closed">MERCADO FECHADO</span>' : ''}
          </div>
          <span class="asset-card__name">${a.name}</span>
        </div>
        <button class="asset-card__favorite" data-action="toggle-favorite" data-symbol="${a.symbol}" title="Favorito">
          ${isFav ? Icon.StarFilled : Icon.Star}
        </button>
      </div>
      <div class="asset-card__prices">
        <span class="asset-card__price">${priceStr}</span>
        <span class="asset-card__change asset-card__change--${changeClass}">
          ${changeSign}${a.changePercent.toFixed(2)}%
        </span>
      </div>
      ${state.cacheTime ? `<div class="asset-card__footnote">\u00daltima atualiza\u00e7\u00e3o: ${state.cacheTime}</div>` : ''}
    </div>
  `
}

function renderVolatility() {
  const v = state.volatility
  if (!v) return ''
  const positions = [8, 30, 53, 75]
  const left = `${positions[v.segment] ?? 50}%`

  return `
    <div class="volatility">
      <div class="section-title">VOLATILIDADE DO MERCADO</div>
      <div class="volatility__segments">
        <div class="volatility__indicator" style="left:${left}">\u25B2</div>
        <div class="volatility__seg"></div>
        <div class="volatility__seg"></div>
        <div class="volatility__seg"></div>
        <div class="volatility__seg"></div>
      </div>
      <div class="volatility__labels">
        <span class="volatility__label">CALMO</span>
        <span class="volatility__label">MODERADO</span>
        <span class="volatility__label">ALTO RISCO</span>
      </div>
    </div>
  `
}

function renderAnalystCard() {
  if (!state.analystNote) return ''
  const lines = state.analystNote.split('\n').filter(Boolean)

  return `
    <div class="analyst-card">
      <div class="analyst-card__badge">
        <span class="analyst-card__dot"></span>
        <span class="analyst-card__badge-text">An\u00e1lise Opera Trader</span>
      </div>
      <p class="analyst-card__text">${lines.map(l => `${l}<br>`).join('')}</p>
    </div>
  `
}

function renderCTA() {
  return `
    <div class="cta-footer">
      <button class="cta-footer__btn" data-action="open-platform">
        Acessar an\u00e1lise completa no Opera Trader System
        ${Icon.ChevronRight}
      </button>
    </div>
  `
}

function renderDisclaimer() {
  return `
    <p class="disclaimer">
      Conte\u00fado informativo e educacional. N\u00e3o constitui recomenda\u00e7\u00e3o de investimento.
    </p>
  `
}

function renderError() {
  return `
    <div class="error-card">
      <div class="error-card__icon">${Icon.AlertCircle}</div>
      <div class="error-card__content">
        <p class="error-card__title">Dados indispon\u00edveis</p>
        <p class="error-card__desc">${state.error}</p>
      </div>
    </div>
  `
}

function renderLoading() {
  return `
    ${renderHeader()}
    <div class="skeleton skeleton--card"></div>
    <div class="skeleton skeleton--sm"></div>
    <div class="skeleton skeleton--card"></div>
    <div class="skeleton skeleton--sm"></div>
    <div class="skeleton skeleton--sm"></div>
  `
}

function renderSettings() {
  const tier = state.licenseTier

  return `
    <div class="settings">
      <div class="settings__header">
        <button class="settings__back" data-action="back" title="Voltar">${Icon.ArrowLeft}</button>
        <h2 class="settings__title">Configura\u00e7\u00f5es</h2>
      </div>

      <div class="settings__section">
        <span class="settings__label">Tema</span>
        <button class="settings__theme-btn" data-action="toggle-theme">
          ${state.theme === 'dark' ? '\u2600 Claro' : '\u263E Escuro'}
        </button>
      </div>

      <div class="settings__section">
        <span class="settings__label">Licen\u00e7a</span>
        <div class="settings__license-row">
          <input class="settings__input" type="text" placeholder="Chave de licen\u00e7a"
            data-license-input value="${state.licenseKey}" />
          <button class="settings__validate-btn" data-action="validate-license">Validar</button>
        </div>
        <div class="settings__tier-row">
          <span class="settings__tier-label">Status:</span>
          ${tierBadge(tier)}
        </div>
      </div>

      ${tier === 'founder' ? renderFounderBadge() : ''}

      <div class="settings__section">
        <span class="settings__label">Favoritos (${state.favorites.length}/5)</span>
        ${state.favorites.length === 0
          ? '<p class="settings__empty-favs">Nenhum favorito ainda. Clique na estrela no card do ativo.</p>'
          : state.favorites.map(sym => `
              <div class="settings__fav-row">
                <span class="settings__fav-symbol">${sym}</span>
                <button class="settings__fav-remove" data-action="remove-favorite" data-symbol="${sym}">Remover</button>
              </div>
            `).join('')
        }
      </div>
    </div>
  `
}

function renderFounderBadge() {
  return `
    <div class="founder-badge">
      <div class="founder-badge__sep">\u25C7</div>
      <div class="founder-badge__title">FOUNDER MEMBER</div>
      <div class="founder-badge__sub">Opera Trader</div>
      <div class="founder-badge__year">2026</div>
      <div class="founder-badge__sep">\u25C7</div>
    </div>
  `
}

/* ─── Helpers ─── */

function tierBadge(tier) {
  const map = {
    free: { label: 'Free', cls: 'badge--free' },
    founder: { label: 'Founder Member', cls: 'badge--founder' },
    pro: { label: 'Pro', cls: 'badge--pro' },
  }
  const m = map[tier] || map.free
  return `<span class="badge ${m.cls}">${m.label}</span>`
}

/* ─── Event binding (delegation, called once) ─── */

function bindEvents() {
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-action], [data-cal-filter], [data-symbol]')

    if (!t) {
      if (!e.target.closest('.search')) {
        document.querySelector('[data-search-dropdown]')?.classList.remove('search__dropdown--open')
      }
      return
    }

    const action = t.dataset.action

    if (action === 'toggle-theme') {
      state.theme = state.theme === 'dark' ? 'light' : 'dark'
      document.documentElement.setAttribute('data-theme', state.theme)
      chrome.storage.sync.set({ theme: state.theme }).catch(() => {})
      render()
      return
    }

    if (action === 'open-settings') { state.view = 'settings'; render(); return }
    if (action === 'back') { state.view = 'main'; render(); return }

    if (action === 'open-platform') {
      chrome.tabs.create({ url: 'https://www.operatrader.com.br/?utm_source=extension&utm_medium=cta&utm_campaign=morning_call' })
        .catch(() => window.open(url, '_blank'))
      return
    }

    if (action === 'toggle-favorite') {
      const sym = t.dataset.symbol
      const idx = state.favorites.indexOf(sym)
      if (idx >= 0) state.favorites.splice(idx, 1)
      else if (state.favorites.length < 5) state.favorites.push(sym)
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
        state.licenseTier = result.valid ? result.tier : 'free'
        chrome.storage.sync.set({ licenseKey: key, licenseTier: state.licenseTier }).catch(() => {})
        render()
      })
      return
    }

    if (action === 'remove-favorite') {
      state.favorites = state.favorites.filter(s => s !== t.dataset.symbol)
      chrome.storage.sync.set({ favorites: state.favorites }).catch(() => {})
      render()
      return
    }

    if (t.matches('[data-cal-filter]')) {
      const [type, value] = t.dataset.calFilter.split(':')
      if (type === 'country') {
        const idx = state.calendarCountries.indexOf(value)
        if (idx >= 0) state.calendarCountries.splice(idx, 1)
        else state.calendarCountries.push(value)
        if (state.calendarCountries.length === 0) state.calendarCountries.push(value)
        chrome.storage.sync.set({ calendarCountries: state.calendarCountries }).catch(() => {})
      } else if (type === 'weekday') {
        const dayIdx = Number(value)
        const idx = state.calendarWeekdays.indexOf(dayIdx)
        if (idx >= 0) state.calendarWeekdays.splice(idx, 1)
        else state.calendarWeekdays.push(dayIdx)
        chrome.storage.sync.set({ calendarWeekdays: state.calendarWeekdays }).catch(() => {})
      }
      render()
      return
    }

    if (t.matches('[data-symbol]') && !t.matches('[data-action]')) {
      const sym = t.dataset.symbol
      state.selectedSymbol = sym
      const input = document.querySelector('[data-search-input]')
      if (input) input.value = sym
      document.querySelector('[data-search-dropdown]')?.classList.remove('search__dropdown--open')
      loadAsset(sym)
    }
  })

  /* Search input filtering */
  let searchTimer
  document.addEventListener('input', (e) => {
    const input = e.target.closest('[data-search-input]')
    if (!input) return
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      const q = input.value.toLowerCase()
      document.querySelectorAll('[data-search-dropdown] [data-symbol]').forEach(el => {
        const sym = (el.dataset.symbol || '').toLowerCase()
        const name = (el.querySelector('.search__option-name')?.textContent || '').toLowerCase()
        el.style.display = sym.includes(q) || name.includes(q) ? '' : 'none'
      })
      const dd = document.querySelector('[data-search-dropdown]')
      if (dd) dd.classList.toggle('search__dropdown--open', q.length > 0)
    }, 100)
  })

  /* Search focus */
  document.addEventListener('focusin', (e) => {
    const input = e.target.closest('[data-search-input]')
    if (!input) return
    const dd = document.querySelector('[data-search-dropdown]')
    if (dd && input.value.length > 0) dd.classList.add('search__dropdown--open')
  })

  /* License Enter key */
  document.addEventListener('keydown', (e) => {
    if (!e.target.closest('[data-license-input]')) return
    if (e.key === 'Enter') document.querySelector('[data-action="validate-license"]')?.click()
  })
}

/* ─── Data loading ─── */

async function loadAsset(symbol) {
  state.loading = true
  state.error = null
  render()

  const quote = await fetchQuote(symbol)
  const events = await fetchCalendar()
  const news = await fetchNews()

  state.loading = false

  if (quote) {
    state.asset = quote
    state.cacheTime = formatCacheTime(quote.lastUpdated)
  } else {
    state.error = 'Dados indispon\u00edveis.'
  }

  const vol = computeVolatilitySegment(events, news)
  state.volatility = { score: vol.score, segment: vol.segment }

  state.events = events
  state.news = news
  state.analystNote = generateAnalystNote(events, news)

  render()
}

async function init() {
  /* Detect side panel mode */
  const params = new URLSearchParams(window.location.search)
  const isSidePanel = params.get('mode') === 'sidepanel'
  document.documentElement.setAttribute('data-mode', isSidePanel ? 'sidepanel' : 'popup')
  if (isSidePanel) {
    document.documentElement.classList.add('is-sidepanel')
  }

  /* Load preferences */
  try {
    const prefs = await chrome.storage.sync.get(['theme', 'licenseTier', 'licenseKey', 'favorites', 'calendarCountries', 'calendarWeekdays'])
    if (prefs.theme) state.theme = prefs.theme
    if (prefs.licenseTier) state.licenseTier = prefs.licenseTier
    if (prefs.licenseKey) state.licenseKey = prefs.licenseKey
    if (prefs.favorites) state.favorites = prefs.favorites
    if (prefs.calendarCountries) state.calendarCountries = prefs.calendarCountries
    if (prefs.calendarWeekdays) state.calendarWeekdays = prefs.calendarWeekdays
  } catch {
    // Not in extension context
  }

  document.documentElement.setAttribute('data-theme', state.theme)
  bindEvents()

  /* Resolve default contract */
  state.selectedSymbol = resolveCurrentContract('WIN')

  await loadAsset(state.selectedSymbol)
}

document.addEventListener('DOMContentLoaded', init)
