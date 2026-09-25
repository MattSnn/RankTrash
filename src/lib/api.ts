import { createMockApi } from './mockApi'
import { createSupabaseApi } from './supabaseApi'
import type { Api } from './types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const demo = import.meta.env.VITE_DEMO === 'true' || !url || !key

export const api: Api = demo ? createMockApi() : createSupabaseApi(url!, key!)

export const allowedDomains: string[] = ((import.meta.env.VITE_ALLOWED_EMAIL_DOMAINS as string | undefined) ?? 'facens.br')
  .split(',')
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean)

export function isAllowedEmail(email: string): boolean {
  const domain = email.trim().toLowerCase().split('@')[1] ?? ''
  return allowedDomains.length === 0 || allowedDomains.includes(domain)
}
