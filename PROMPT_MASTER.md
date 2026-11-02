# PROMPT MASTER — Opera Morning Call

## Arquitetura Atual (v1.0.1)

- **Proxy Backend:** `opera-proxy.datamapleai.workers.dev/api/v1` (Cloudflare Worker; `USE_MOCK` async, default `false`)
- **Cache:** `chrome.storage.local` com TTL diário + invalidação por horário (18:30 BRT)
- **Background Alarm:** 60 min, atualiza watchlist + macro (lê `useMock` de `chrome.storage.local`)
- **Side Panel:** removido (permissão removida do manifest)
- **Licença:** validação via backend proxy, sem feature gating — badge "Founder Member" apenas estético (o selo é informativo e não altera dados)
- **Mock toggle:** chip "MOCK"/"OFFLINE" no header, seta `useMock` em `chrome.storage.local`

## Stack Técnica

| Camada | Tecnologia |
|--------|------------|
| Manifest | MV3 |
| CSS | Tokens + Components (sem framework) |
| JS | ES Modules nativos |
| Ícones | Lucide (inline SVG, stroke 1.5) |
| Widget | TradingView Events (iframe) |

## Estrutura de Arquivos

```
extension/
├── manifest.json
├── popup.html
├── css/
│   ├── tokens.css
│   └── components.css
├── js/
│   ├── popup.js       (UI + eventos)
│   ├── api.js         (fetch + cache + helpers)
│   └── background.js  (alarmes + cache B3)
├── icons/
│   └── ...

backend/
├── wrangler.toml      (Cloudflare Workers config)
├── src/index.js       (worker: todas as rotas)
├── package.json
└── .env               (BRAPI_TOKEN — gitignored)
```

## Ordem dos Componentes no Popup

1. Header (64px) — logo, refresh, theme, settings
2. Macro Bar — Selic / IPCA 12m / CDI (fonte BCB/SGS)
3. Calendário Econômico — TradingView iframe (importanceFilter "0,1", countryFilter "br,us")
4. Global Insights — 3 notícias
5. Search — input com dropdown de ASSET_LIST, título "Selecione ou digite Ativo"
6. Asset Card — ticker, price, change%, favorite star
7. Curva de Vencimentos — 1 card "VENCIMENTOS", 2 linhas (WIN / WDO) com label lateral, barras IV por contrato (bronze no atual), label com sufixo + IV% abaixo, IV percentile no rodapé
8. Analyst Card — nota gerada com eventos + IV
9. CTA — link para Opera Trader System
10. Disclaimer — texto informativo

## Regras de Negócio

- **Theme toggle** recarrega o src do iframe (TradingView não aceita postMessage para troca de tema)
- **CSP** permite `frame-src` de `www.tradingview-widget.com` e `s.tradingview.com`
- **Cache TTL:** quotes daily (invalida após 18:30 BRT), news 15 min, macro 24h (Selic só em reunião Copom, IPCA mensal — sem invalidação por horário)
- **IV Percentile:** non-blocking após render principal
- **Watchlist:** contratos futuros resolvidos via `resolveCurrentContract()`
- **Preferências:** tema, favoritos (max 5), license key — salvos em `chrome.storage.sync`
- **Mock toggle:** `useMock` em `chrome.storage.local` — lido por `api.js` (async) e `background.js`
- **Backend health check:** `ping()` antes de cada `loadAsset()`, chip no header reflete estado
- **Fallback mock:** se `USE_MOCK = true`, retorna dados mock; se `false` e backend offline, retorna erro

## Endpoints do Backend (base: `opera-proxy.datamapleai.workers.dev/api/v1`)

| Endpoint | Cache | Invalida B3 | Fonte |
|----------|-------|-------------|-------|
| `GET /api/v1/watchlist` | 24h | Sim | brapi /futures/quote |
| `GET /api/v1/quote` | 1h | Não | brapi /stocks/quote |
| `GET /api/v1/term-structure` | 1h | Não | brapi /futures/term-structure |
| `GET /api/v1/macro` | 24h | Não | BCB/SGS (séries 432, 13522, 4389) |
| `GET /api/v1/news` | 15min | Não | Google News RSS |
| `POST /api/v1/license/validate` | — | — | Próprio |
| `GET /api/v1/health` | — | — | Ping simples |

## Contratos Suportados

- WIN (Mini Índice) — vencimentos nos meses G,J,M,Q,V,Z
- WDO (Mini Dólar) — todos os meses
- IND (Índice Futuro Cheio) — vencimentos nos meses G,J,M,Q,V,Z
- DOL (Dólar Futuro Cheio) — todos os meses
- Ações: via `ASSET_LIST` quando adicionadas

## Integrações Externas (backend proxy)

| Serviço | Uso | Status |
|---------|-----|--------|
| **brapi.dev** | Cotações de ações e futuros (chave mantida somente como secret do Worker) | ✅ Plano pago |
| **BCB/SGS (api.bcb.gov.br)** | Selic meta (série 432), IPCA 12m (13522), CDI Over (4389) — **fonte primária oficial** | ✅ Implementado no Worker |
| **brapi.dev /macro** | Mesmas séries via brapi — **NÃO usar, plano pago atual também bloqueia macro (403 FEATURE_NOT_AVAILABLE)** | Bloqueado por plano |
| **TradingView** | Widget de calendário econômico via iframe | Real (carrega direto no popup) |
| **Google News RSS** | Feed de notícias econômicas (consumido pelo Worker) | ✅ Implementado no Worker |
| **Calendário Copom/FOMC** | Datas **heurísticas/aproximadas** (não é agenda oficial) — eventos marcados `estimated: true` | Heurística |

**Volatilidade:** o "IV" exibido é um **proxy** derivado da oscilação do contrato (`15 + |osc|*0.8`) e o "índice/percentil" é `clamp(iv*2.5)`. **Não é IV de opções nem percentil histórico.** A UI rotula como "Vol. estimada (proxy)".

**Regra de segurança:** Nenhuma chave de API pode ficar hardcoded em `extension/`. Todas as chaves ficam no backend (Worker) em variáveis de ambiente. O Worker exige `Origin` de extensão/website nas rotas protegidas e aplica rate limit básico; configure `EXTENSION_ID` em `wrangler.toml` para restringir a origem.

## Deploy do Backend (Cloudflare Workers)

```bash
cd backend
npm install
npx wrangler secret put BRAPI_TOKEN    # cola a chave quando pedir
npx wrangler secret put FOUNDER_LICENSE_KEY
npx wrangler deploy                     # deploy no ar
```

**URL do worker:** `https://opera-proxy.<subdomain>.workers.dev`
**Custom domain:** configurar `api.operatrader.com.br` como custom domain no Cloudflare

**Variáveis de ambiente (wrangler.toml):**
- `BRAPI_BASE` = `https://brapi.dev/api/v2`
- `BCB_BASE` = `https://api.bcb.gov.br/dados/serie`
- `BRAPI_TOKEN` = secret (usar `wrangler secret put`)
- `FOUNDER_LICENSE_KEY` = secret usado na validação de licenças
