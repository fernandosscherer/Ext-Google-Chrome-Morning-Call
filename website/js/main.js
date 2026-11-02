/* ─── Theme ─── */

function getTheme() {
  try { return localStorage.getItem('theme') || 'dark' } catch { return 'dark' }
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme)
  try { localStorage.setItem('theme', theme) } catch {}
}

/* Toggle */
document.addEventListener('DOMContentLoaded', () => {
  setTheme(getTheme())

  document.querySelectorAll('[data-action="toggle-theme"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'
      setTheme(next)
      updateThemeIcons(next)
    })
  })

  updateThemeIcons(getTheme())
})

function updateThemeIcons(theme) {
  document.querySelectorAll('[data-theme-icon]').forEach(el => {
    el.innerHTML = theme === 'dark'
      ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>'
      : '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>'
  })
}

/* ─── Nav scroll ─── */

document.addEventListener('DOMContentLoaded', () => {
  const nav = document.querySelector('.nav')
  let ticking = false
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        nav.classList.toggle('nav--scrolled', window.scrollY > 20)
        ticking = false
      })
      ticking = true
    }
  })
})

/* ─── Mobile nav ─── */

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.querySelector('.nav__mobileBtn')
  const menu = document.querySelector('.nav__links')
  if (btn && menu) {
    btn.addEventListener('click', () => menu.classList.toggle('nav__links--open'))
    document.querySelectorAll('.nav__link').forEach(link => {
      link.addEventListener('click', () => menu.classList.remove('nav__links--open'))
    })
  }
})

/* ─── Smooth scroll (anchor links) ─── */

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href')
      if (id === '#') return
      const target = document.querySelector(id)
      if (target) {
        e.preventDefault()
        target.scrollIntoView({ behavior: 'smooth' })
      }
    })
  })
})

/* ─── Fade-up animation on scroll ─── */

document.addEventListener('DOMContentLoaded', () => {
  const els = document.querySelectorAll('.fade-up')
  if (!els.length) return
  if ('IntersectionObserver' in window) {
    const obs = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('fade-up--visible')
          obs.unobserve(entry.target)
        }
      })
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' })
    els.forEach(el => obs.observe(el))
  } else {
    els.forEach(el => el.classList.add('fade-up--visible'))
  }
})

/* ─── Install click tracking ─── */

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-track="install"]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (typeof window.gtag === 'function') {
        gtag('event', 'install_click', {
          event_category: 'conversion',
          event_label: btn.dataset.location || 'unknown',
        })
      }
    })
  })

  document.querySelectorAll('[data-track="opera-trader"]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (typeof window.gtag === 'function') {
        gtag('event', 'opera_trader_click', {
          event_category: 'conversion',
          event_label: 'cta_final',
        })
      }
    })
  })

  /* Fallback UTM params on Opera Trader link */
  document.querySelectorAll('[data-track="opera-trader"]').forEach(el => {
    const href = el.getAttribute('href')
    if (href && !href.includes('utm_source')) {
      const url = new URL(href)
      url.searchParams.set('utm_source', 'morning_call')
      url.searchParams.set('utm_medium', 'cta')
      url.searchParams.set('utm_campaign', 'landing_final')
      el.setAttribute('href', url.toString())
    }
  })
})

/* ─── Service worker registration (PWA-like install prompt) ─── */

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    /* SW registration placeholder — enable when hosting with HTTPS */
  })
}
