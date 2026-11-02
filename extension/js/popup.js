import {
  ASSET_LIST,
  fetchWatchlist, fetchQuote, fetchTermStructure, fetchIVPercentile,
  fetchMacro, fetchNews, fetchCalendar, validateLicense, ping, getUseMock, setUseMock,
  resolveCurrentContract, getResolvedSymbol,
  generateAnalystNote,
} from './api.js'

/* ─── Escaping (previne XSS em dados vindos do backend) ─── */

function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

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
  Refresh: S('<path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>'),
  ArrowLeft: S('<path d="m15 18-6-6 6-6"/>', 18, 18),
  AlertCircle: S('<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>', 16, 16),
}

/* ─── Logo SVG ─── */

const LogoSvg = `
<svg class="header__logo-svg" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <path d="M144 32a80 80 0 1 0 0 160 80 80 0 0 0 0-160Zm0 130a50 50 0 1 1 0-100 50 50 0 0 1 0 100Z" fill="currentColor"/>
  <path d="M144 62v42l30 20" stroke="#D79A32" stroke-width="14" stroke-linecap="round" fill="none"/>
  <path d="M228 30q0 26 20 40t20 40q0 26-20 40" stroke="currentColor" stroke-width="16" stroke-linecap="round" fill="none"/>
  <path d="M298 30q0 26 20 40t20 40q0 26-20 40" stroke="currentColor" stroke-width="16" stroke-linecap="round" fill="none"/>
  <path d="M368 30q0 26 20 40t20 40q0 26-20 40" stroke="currentColor" stroke-width="16" stroke-linecap="round" fill="none"/>
  <path d="M78 208h306a12 12 0 0 1 12 12v168a86 86 0 0 1-86 86H152a86 86 0 0 1-86-86V220a12 12 0 0 1 12-12Z" class="cup-body" stroke="currentColor" stroke-width="16"/>
  <path d="M396 250h56a44 44 0 0 1 44 44v40a76 76 0 0 1-76 76h-24" fill="none" stroke="currentColor" stroke-width="16"/>
  <circle cx="330" cy="290" r="9" fill="#D79A32"/>
  <rect x="322" y="320" width="16" height="60" rx="8" fill="#D79A32"/>
  <path d="M40 442h380a10 10 0 0 1 10 10 62 62 0 0 1-62 62H92a62 62 0 0 1-62-62 10 10 0 0 1 10-10Z" fill="currentColor"/>
</svg>`

/* ─── TradingView Calendar Widget ─── */

function getCalendarUrl(theme) {
  const s = {
    colorTheme: theme,
    isTransparent: true,
    width: '100%',
    height: 380,
    importanceFilter: '0,1',
    countryFilter: 'br,us',
  }
  const url = new URL('https://www.tradingview-widget.com/embed-widget/events/')
  url.searchParams.set('locale', 'br')
  url.hash = encodeURIComponent(JSON.stringify(s))
  return url.toString()
}

/* ─── State ─── */

const state = {
  view: 'main',
  theme: 'dark',
  loading: true,
  error: null,
  useMock: false,
  backendOnline: false,
  watchlist: [],
  asset: null,
  termStructures: {},
  ivPercentile: null,
  macro: null,
  news: null,
  analystNote: '',
  calendarEvents: [],
  selectedSymbol: '',
  licenseTier: 'free',
  licenseKey: '',
  favorites: [],
}

/* ─── Render ─── */

function render() {
  const app = document.getElementById('app')
  if (!app) return

  let frame = document.getElementById('tv-calendar')
  const keepFrame = frame && frame.src === getCalendarUrl(state.theme)
  const savedFrame = keepFrame ? frame : null
  if (savedFrame) savedFrame.remove()

  const searchInput = document.querySelector('[data-search-input]')
  const searchIsFocused = document.activeElement === searchInput
  const searchValue = searchInput ? searchInput.value : null
  const searchDd = document.querySelector('[data-search-dropdown]')
  const searchDdWasOpen = searchDd ? searchDd.classList.contains('search__dropdown--open') : false

  const licenseInput = document.querySelector('[data-license-input]')
  const licenseIsFocused = document.activeElement === licenseInput
  const licenseValue = licenseInput ? licenseInput.value : null

  if (state.view === 'settings') {
    app.innerHTML = renderSettings()
  } else if (state.loading) {
    app.innerHTML = renderLoading()
  } else {
    app.innerHTML = `
      ${renderHeader()}
      ${renderMacro()}
      ${renderWatchlist()}
      ${calendarMarkup()}
      ${renderInsights()}
      ${renderSearch()}
      ${state.error ? renderError() : renderAssetCard()}
      ${state.error ? '' : renderTermStructure()}
      ${state.error ? '' : renderAnalystCard()}
      ${renderCTA()}
      ${renderDisclaimer()}
    `
  }

  const mount = document.getElementById('calendar-mount')
  if (mount) {
    if (savedFrame) mount.appendChild(savedFrame)
    else mount.appendChild(buildCalendarIframe())
  }

  if (searchValue !== null) {
    const newSearch = document.querySelector('[data-search-input]')
    if (newSearch) {
      newSearch.value = searchValue
      if (searchIsFocused) {
        newSearch.focus()
        newSearch.setSelectionRange(searchValue.length, searchValue.length)
      }
      if (searchDdWasOpen) applySearchFilter(searchValue)
    }
  }

  if (licenseValue !== null) {
    const newLicense = document.querySelector('[data-license-input]')
    if (newLicense) {
      newLicense.value = licenseValue
      if (licenseIsFocused) {
        newLicense.focus()
        newLicense.setSelectionRange(licenseValue.length, licenseValue.length)
      }
    }
  }
}

/* ─── Component renders ─── */

function renderHeader() {
  const chip = state.useMock
    ? `<button class="header__chip header__chip--mock" data-action="toggle-mock" title="Modo mock ativo. Clique para desativar.">MOCK</button>`
    : !state.backendOnline && !state.loading
      ? `<button class="header__chip header__chip--offline" data-action="toggle-mock" title="Backend offline. Clique para usar mock.">OFFLINE</button>`
      : ''
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
        ${chip}
        ${state.loading ? '<span class="header__loader"></span>' : ''}
        <button class="header__btn" data-action="toggle-theme" title="Alternar tema">
          ${state.theme === 'dark' ? Icon.Sun : Icon.Moon}
        </button>
        <button class="header__btn" data-action="refresh" title="Atualizar">
          ${Icon.Refresh}
        </button>
        <button class="header__btn" data-action="open-settings" title="Configura\u00e7\u00f5es">
          ${Icon.Settings}
        </button>
      </div>
    </header>
  `
}

function renderMacro() {
  const m = state.macro
  if (!m) return ''
  const items = [
    { label: 'Selic', value: m.selic, suffix: '% a.a.', source: 'BCB/SGS 432' },
    { label: 'IPCA 12m', value: m.ipca12m, suffix: '%', source: 'BCB/SGS 13522' },
    { label: 'CDI', value: m.cdi, suffix: '% a.a.', source: 'BCB/SGS 4389' },
  ]
  const fmt = (v) => (v == null || Number.isNaN(Number(v)) ? '&mdash;' : Number(v).toFixed(2))
  return `
    <div class="card-section macro-bar" title="Fonte: Banco Central do Brasil · SGS">
      <div class="section-title">Indicadores Macro</div>
      <div class="macro-bar__items">
        ${items.map(i => `
          <div class="macro-bar__item">
            <span class="macro-bar__label">${esc(i.label)}</span>
            <span class="macro-bar__value">${fmt(i.value)}<small>${esc(i.suffix)}</small></span>
          </div>
        `).join('')}
      </div>
    </div>
  `
}

function renderWatchlist() {
  const items = state.watchlist
  if (!items || items.length === 0) return ''
  return `
    <div class="watchlist">
      ${items.map(item => {
        const change = Number(item.changePercent) || 0
        const price = Number(item.price ?? item.lastClose) || 0
        const isActive = item.symbol === state.selectedSymbol
        const isUp = change >= 0
        return `
          <button class="watchlist__item ${isActive ? 'watchlist__item--active' : ''}"
                  data-symbol="${esc(item.symbol)}" data-action="select-watchlist">
            <span class="watchlist__symbol">${esc(item.symbol)}</span>
            <span class="watchlist__price ${isUp ? 'up' : 'down'}">${price.toLocaleString('pt-BR')}</span>
            <span class="watchlist__change ${isUp ? 'up' : 'down'}">${isUp ? '+' : ''}${change.toFixed(2)}%</span>
          </button>
        `
      }).join('')}
      <p class="watchlist__footnote">Fechamento anterior \u00B7 brapi.dev</p>
    </div>
  `
}

function calendarMarkup() {
  return `
    <div class="card-section calendar-container">
      <div class="section-title">Calend\u00e1rio Econ\u00f4mico</div>
      <div id="calendar-mount"></div>
    </div>
  `
}

function buildCalendarIframe() {
  const iframe = document.createElement('iframe')
  iframe.id = 'tv-calendar'
  iframe.className = 'calendar-iframe'
  iframe.src = getCalendarUrl(state.theme)
  iframe.setAttribute('frameborder', '0')
  iframe.setAttribute('scrolling', 'no')
  iframe.title = 'Calend\u00e1rio Econ\u00f4mico TradingView'
  return iframe
}

function renderInsights() {
  const news = state.news
  if (!news || news.length === 0) return ''
  return `
    <div class="card-section">
      <div class="section-title">Mercado Hoje</div>
      ${news.map(n => `
        <button class="insight-item" data-action="open-news" data-url="${esc(n.url || '#')}">
          <p class="insight-item__title">${esc(n.title)}</p>
          <span class="insight-item__time">${esc(n.source || 'Opera Trader')} \u00B7 ${esc(n.timeAgo)}</span>
        </button>
      `).join('')}
    </div>
  `
}

function renderSearch() {
  const resolved = state.selectedSymbol || resolveCurrentContract('WIN')
  return `
    <div class="search" data-component="search">
      <div class="section-title">Selecione ou digite Ativo</div>
      <input class="search__input" type="text" placeholder="Buscar ativo \u2014 ex: WINQ26, WDOQ26"
        data-search-input value="${esc(resolved)}" autocomplete="off" spellcheck="false" />
      <div class="search__dropdown" data-search-dropdown>
        ${ASSET_LIST.map(a => {
          const sym = getResolvedSymbol(a)
          const isActive = sym === state.selectedSymbol
          return `
            <div class="search__option ${isActive ? 'search__option--active' : ''}"
                 data-symbol="${esc(sym)}" data-base="${esc(a.base)}">
              <span class="search__option-symbol">${esc(sym)}</span>
              <span class="search__option-name">${esc(a.name)}</span>
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
  const change = Number(a.changePercent) || 0
  const price = Number(a.price ?? a.lastClose) || 0
  const isUp = change >= 0
  const changeClass = isUp ? 'up' : 'down'
  const changeSign = isUp ? '+' : ''
  const isFav = state.favorites.includes(a.symbol)

  return `
    <div class="asset-card">
      <div class="asset-card__header">
        <div class="asset-card__info">
          <div class="asset-card__symbol-row">
            <span class="asset-card__symbol">${esc(a.symbol)}</span>
            ${!a.isMarketOpen ? '<span class="asset-card__badge-closed">MERCADO FECHADO</span>' : ''}
          </div>
          <span class="asset-card__name">${esc(a.name)}</span>
        </div>
        <button class="asset-card__favorite" data-action="toggle-favorite" data-symbol="${esc(a.symbol)}" title="Favorito">
          ${isFav ? Icon.StarFilled : Icon.Star}
        </button>
      </div>
      <div class="asset-card__prices">
        <span class="asset-card__price">${price.toLocaleString('pt-BR')}</span>
        <span class="asset-card__change asset-card__change--${changeClass}">
          ${changeSign}${change.toFixed(2)}%
        </span>
      </div>
      ${state.asset.lastClose ? `<div class="asset-card__footnote">Fechamento anterior \u00B7 brapi.dev</div>` : ''}
    </div>
  `
}

function renderTermStructure() {
  const all = state.termStructures
  const hasData = (all.WIN && all.WIN.length > 0) || (all.WDO && all.WDO.length > 0)
  if (!hasData) return ''

  const iv = state.ivPercentile
  const ivColor = iv == null ? '' : iv < 50 ? 'var(--color-success)' : iv <= 80 ? 'var(--color-warning)' : 'var(--color-danger)'
  const selectedBase = state.selectedSymbol.match(/^(WIN|WDO)/)?.[1] || 'WIN'
  const selectedTerms = all[selectedBase] || []

  const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

  function renderRow(base, terms) {
    if (!terms || terms.length === 0) return ''
    const maxIv = Math.max(...terms.map(t => Number(t.iv) || 0)) || 1
    return `
      <div class="ts-row">
        <span class="ts-row__label">${esc(base)}</span>
        <div class="term-structure">
          ${terms.map(t => {
            const pct = (Number(t.iv) || 0) / maxIv * 100
            const m = t.expiration ? MONTHS[new Date(t.expiration).getMonth()] : ''
            return `
              <div class="ts-item">
                <div class="ts-bar ${t.isCurrent ? 'ts-bar--current' : ''}"
                     style="height:${Math.max(pct, 15)}%"></div>
                <span class="ts-label">${esc(t.contract.replace(/^.{3}/, ''))}</span>
                <span class="ts-month">${esc(m)}</span>
              </div>
            `
          }).join('')}
        </div>
      </div>
    `
  }

  return `
    <div class="card-section">
      <div class="section-title">Vencimentos</div>
      ${renderRow('WIN', all.WIN)}
      ${renderRow('WDO', all.WDO)}
      ${iv != null ? `
        <div class="ts-iv" style="--iv-color: ${ivColor}" title="Estimativa derivada da oscila\u00e7\u00e3o do contrato \u2014 n\u00e3o \u00e9 volatilidade impl\u00edcita de op\u00e7\u00f5es.">
          <span class="ts-iv__value">${(selectedTerms.find(t => t.isCurrent)?.iv ?? 0).toFixed(1)}%</span>
          <span class="ts-iv__label">Vol. estimada (proxy) \u00b7 \u00edndice ${iv}</span>
        </div>
      ` : ''}
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
      <p class="analyst-card__text">${lines.map(l => `${esc(l)}<br>`).join('')}</p>
    </div>
  `
}

function renderCTA() {
  return `
    <div class="cta-footer">
      <p class="cta-context"><strong>Automa\u00e7\u00e3o e Intelig\u00eancia de mercado. Tudo em um s\u00f3 lugar para elevar seu trading. Conhe\u00e7a!</strong></p>
      <button class="cta-opera-trader" data-action="open-platform">
        Entrar na lista de espera do Opera Trader
        ${Icon.ChevronRight}
      </button>
    </div>
  `
}

function renderDisclaimer() {
  return `
    <p class="disclaimer">
      Conte\u00fado exclusivamente informativo e educacional. N\u00e3o constitui recomenda\u00e7\u00e3o, oferta ou consultoria de investimentos.
    </p>
  `
}

function renderError() {
  return `
    <div class="error-card">
      <div class="error-card__icon">${Icon.AlertCircle}</div>
      <div class="error-card__content">
        <p class="error-card__title">Dados indispon\u00edveis</p>
        <p class="error-card__desc">${esc(state.error)}</p>
      </div>
    </div>
  `
}

function renderLoading() {
  return `
    ${renderHeader()}
    ${renderMacro()}
    ${renderWatchlist()}
    ${calendarMarkup()}
    ${renderInsights()}
    ${renderSearch()}
    <div class="skeleton skeleton--card"></div>
    <div class="skeleton skeleton--sm"></div>
    <div class="skeleton skeleton--card"></div>
    <div class="skeleton skeleton--sm"></div>
  `
}

function renderSettings() {
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
            data-license-input value="${esc(state.licenseKey)}" />
          <button class="settings__validate-btn" data-action="validate-license">Validar</button>
        </div>
        <div class="settings__tier-row">
          <span class="settings__tier-label">Status:</span>
          ${tierBadge(state.licenseTier)}
        </div>
        <p class="settings__note">O selo \u00e9 informativo e n\u00e3o altera os dados exibidos.</p>
      </div>
      <div class="settings__section">
        <span class="settings__label">Favoritos (${state.favorites.length}/5)</span>
        ${state.favorites.length === 0
          ? '<p class="settings__empty-favs">Nenhum favorito ainda.</p>'
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

function tierBadge(tier) {
  const map = {
    free: { label: 'Free', cls: 'badge--free' },
    founder: { label: 'Founder Member', cls: 'badge--founder' },
    pro: { label: 'Pro', cls: 'badge--pro' },
  }
  const m = map[tier] || map.free
  return `<span class="badge ${m.cls}">${m.label}</span>`
}

/* ─── Search filtering ─── */

const SYMBOL_RE = /^[A-Z0-9]{2,12}$/

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

/* ─── Event binding ─── */

function bindEvents() {
  /* Theme toggle (reloads calendar iframe) */
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

    if (action === 'toggle-mock') {
      const next = !state.useMock
      setUseMock(next).then(() => {
        state.useMock = next
        loadAsset(state.selectedSymbol)
      })
      return
    }

    if (action === 'refresh') {
      loadAsset(state.selectedSymbol, { force: true })
      return
    }

    if (action === 'open-settings') { state.view = 'settings'; render(); return }
    if (action === 'back') { state.view = 'main'; render(); return }

    if (action === 'open-platform') {
      const url = 'https://www.operatrader.com.br/?utm_source=extension&utm_medium=cta&utm_campaign=morning_call'
      chrome.tabs.create({ url }).catch(() => window.open(url, '_blank'))
      return
    }

    if (action === 'open-news') {
      const url = t.dataset.url
      if (url && url !== '#' && url.startsWith('http')) {
        chrome.tabs.create({ url }).catch(() => window.open(url, '_blank'))
      }
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
        state.licenseTier = result.tier || 'free'
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

    if (action === 'select-watchlist') {
      const sym = t.dataset.symbol
      state.selectedSymbol = sym
      loadAsset(sym)
      return
    }
  })

  /* Search input */
  document.addEventListener('click', (e) => {
    const opt = e.target.closest('[data-symbol]')
    if (!opt || !opt.closest('[data-search-dropdown]')) return
    const sym = opt.dataset.symbol
    state.selectedSymbol = sym
    const input = document.querySelector('[data-search-input]')
    if (input) input.value = sym
    document.querySelector('[data-search-dropdown]')?.classList.remove('search__dropdown--open')
    loadAsset(sym)
  })

  let searchTimer
  document.addEventListener('input', (e) => {
    const input = e.target.closest('[data-search-input]')
    if (!input) return
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => applySearchFilter(input.value), 100)
  })

  document.addEventListener('keydown', (e) => {
    const input = e.target.closest('[data-search-input]')
    if (!input || e.key !== 'Enter') return
    const val = input.value.trim().toUpperCase()
    if (!val) return
    const visible = document.querySelector('[data-search-dropdown] [data-symbol]:not([style*="display: none"])')
    if (visible) {
      state.selectedSymbol = visible.dataset.symbol
      input.value = visible.dataset.symbol
      loadAsset(visible.dataset.symbol)
    } else if (SYMBOL_RE.test(val)) {
      state.selectedSymbol = val
      loadAsset(val)
    }
    document.querySelector('[data-search-dropdown]')?.classList.remove('search__dropdown--open')
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
}

/* ─── Data loading ─── */

let loadSeq = 0

async function loadAsset(symbol, { force = false } = {}) {
  const seq = ++loadSeq
  state.loading = true
  state.error = null
  state.ivPercentile = null
  state.useMock = await getUseMock()
  render()

  const [health, watchlist, quote, tsWIN, tsWDO, macro, news, calendar] = await Promise.all([
    ping(),
    fetchWatchlist(force),
    fetchQuote(symbol, force),
    fetchTermStructure('WIN', force),
    fetchTermStructure('WDO', force),
    fetchMacro(force),
    fetchNews(force),
    fetchCalendar(force),
  ])
  if (seq !== loadSeq) return

  state.backendOnline = health.ok

  state.watchlist = watchlist || []

  state.loading = false

  if (quote) {
    state.asset = quote
  } else if (!state.useMock) {
    state.error = 'Backend offline ou cota\u00e7\u00e3o indispon\u00edvel.'
  } else {
    state.error = 'Dados indispon\u00edveis.'
  }

  state.termStructures = {
    WIN: tsWIN || [],
    WDO: tsWDO || [],
  }
  state.macro = macro || null
  state.news = news || null
  state.calendarEvents = calendar || []

  /* IV percentile (non-blocking) */
  fetchIVPercentile(symbol).then(p => {
    if (seq !== loadSeq) return
    state.ivPercentile = p
    reanalyse()
    render()
  })

  reanalyse()
  render()
}

function reanalyse() {
  const events = state.calendarEvents
  state.analystNote = generateAnalystNote(events, state.ivPercentile)
}

/* ─── Init ─── */

async function init() {
  try {
    const prefs = await chrome.storage.sync.get(['theme', 'licenseTier', 'licenseKey', 'favorites'])
    if (prefs.theme) state.theme = prefs.theme
    if (prefs.licenseTier) state.licenseTier = prefs.licenseTier
    if (prefs.licenseKey) state.licenseKey = prefs.licenseKey
    if (prefs.favorites) state.favorites = prefs.favorites
  } catch {}

  state.useMock = await getUseMock()

  document.documentElement.setAttribute('data-theme', state.theme)
  bindEvents()

  window.addEventListener('message', (e) => {
    if (e.origin !== 'https://www.tradingview-widget.com') return
    if (e.data?.name === 'tv-widget-resize-iframe') {
      const frame = document.getElementById('tv-calendar')
      if (!frame || e.source !== frame.contentWindow) return
      if (e.data.data?.width) frame.style.width = e.data.data.width + 'px'
      if (e.data.data?.height) frame.style.height = e.data.data.height + 'px'
    }
  })

  state.selectedSymbol = resolveCurrentContract('WIN')
  await loadAsset(state.selectedSymbol)
}

document.addEventListener('DOMContentLoaded', init)
