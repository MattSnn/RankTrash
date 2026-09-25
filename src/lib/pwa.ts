// Instalação do PWA: captura o prompt nativo (Android/Chrome) e detecta a plataforma.
import { useSyncExternalStore } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type Platform = 'ios' | 'android' | 'desktop'

const DISMISS_KEY = 'ranktrash:install-dismissed'

let deferred: BeforeInstallPromptEvent | null = null
let installed = false
let gateOpen = !isStandalone() && isMobile() && !dismissedThisSession()
const listeners = new Set<() => void>()
let snapshot = makeSnapshot()

function makeSnapshot() {
  return { canPrompt: deferred != null, installed: installed || isStandalone(), gateOpen }
}

function notify() {
  snapshot = makeSnapshot()
  listeners.forEach((l) => l())
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as BeforeInstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    installed = true
    gateOpen = false
    notify()
  })
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: fullscreen)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function detectPlatform(): Platform {
  const ua = navigator.userAgent
  const iPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  if (/iPhone|iPad|iPod/.test(ua) || iPadOS) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  return 'desktop'
}

/** Safari "de verdade" no iOS (Chrome/Firefox/Edge/app do Google têm outro nome no UA). */
export function isIosSafari(): boolean {
  return detectPlatform() === 'ios' && !/CriOS|FxiOS|EdgiOS|GSA|Instagram|FBAN|FBAV/.test(navigator.userAgent)
}

function isMobile(): boolean {
  return typeof navigator !== 'undefined' && detectPlatform() !== 'desktop'
}

function dismissedThisSession(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false
  const evt = deferred
  await evt.prompt()
  const { outcome } = await evt.userChoice
  deferred = null
  if (outcome === 'accepted') {
    installed = true
    gateOpen = false
  }
  notify()
  return outcome === 'accepted'
}

export function openInstallGate() {
  gateOpen = true
  notify()
}

/** "Agora não": some só até o app ser aberto de novo no navegador. */
export function dismissInstallGate() {
  try {
    sessionStorage.setItem(DISMISS_KEY, '1')
  } catch {
    /* sem storage: só fecha */
  }
  gateOpen = false
  notify()
}

export function usePwaInstall() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => snapshot,
  )
}
