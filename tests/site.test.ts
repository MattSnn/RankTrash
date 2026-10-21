import { describe, expect, it } from 'vitest'
import { appUrl, resolveLandingUrl } from '../src/lib/site.ts'

describe('resolveLandingUrl', () => {
  it('usa o subdomínio "sobre" em produção', () => {
    expect(resolveLandingUrl('ranktrash.eco.br')).toBe('https://sobre.ranktrash.eco.br')
    expect(resolveLandingUrl('www.ranktrash.eco.br')).toBe('https://sobre.ranktrash.eco.br')
  })
  it('usa a página local em dev e previews', () => {
    expect(resolveLandingUrl('localhost')).toBe('/landing.html')
    expect(resolveLandingUrl('ranktrash.vercel.app')).toBe('/landing.html')
  })
  it('não confunde domínios parecidos', () => {
    expect(resolveLandingUrl('meuranktrash.eco.br')).toBe('/landing.html')
  })
  it('respeita VITE_LANDING_URL', () => {
    expect(resolveLandingUrl('localhost', 'https://exemplo.com')).toBe('https://exemplo.com')
  })
})

describe('appUrl', () => {
  it('aponta para o domínio do app em produção e para a raiz fora dela', () => {
    expect(appUrl('sobre.ranktrash.eco.br')).toBe('https://ranktrash.eco.br')
    expect(appUrl('localhost')).toBe('/')
  })
})
