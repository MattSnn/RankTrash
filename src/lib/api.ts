import { createMockApi } from './mockApi'
import { createSupabaseApi } from './supabaseApi'
import type { Api } from './types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const demo = import.meta.env.VITE_DEMO === 'true' || !url || !key

export const api: Api = demo ? createMockApi() : createSupabaseApi(url!, key!)

