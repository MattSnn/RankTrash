// Endereços do projeto: o app (ranktrash.eco.br) e a landing page (subdomínio "sobre").
const PROD_DOMAIN = 'ranktrash.eco.br'

export const APP_URL = `https://${PROD_DOMAIN}`
export const LANDING_HOST = `sobre.${PROD_DOMAIN}`

/**
 * Endereço da landing page. `VITE_LANDING_URL` tem prioridade. Em produção (ranktrash.eco.br e
 * subdomínios) vai para o subdomínio; em dev/preview usa a página `/landing.html` do mesmo host.
 */
export function resolveLandingUrl(hostname: string, envUrl?: string): string {
  if (envUrl) return envUrl
  const onProd = hostname === PROD_DOMAIN || hostname.endsWith(`.${PROD_DOMAIN}`)
  return onProd ? `https://${LANDING_HOST}` : '/landing.html'
}

export function landingUrl(): string {
  return resolveLandingUrl(window.location.hostname, import.meta.env.VITE_LANDING_URL as string | undefined)
}

/** Endereço do app, visto da landing page: em dev/preview volta para a raiz do mesmo host. */
export function appUrl(hostname = window.location.hostname): string {
  const onProd = hostname === PROD_DOMAIN || hostname.endsWith(`.${PROD_DOMAIN}`)
  return onProd ? APP_URL : '/'
}
