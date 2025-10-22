import { buildQuery, getJson, getPaginated, patchJson, postJson } from './client'

export interface QuotaScheme {
  id: number
  project: number
  project_code: string
  name: string
  version: number
  status: 'draft' | 'published' | 'archived'
  dimensions: QuotaDimension[]
  overflow_policy: 'strict' | 'soft' | 'weighted'
  priority: number
  is_default: boolean
  created_by: number
  created_by_name: string
  created_at: string
  published_at: string | null
  cell_count: number
}

export interface QuotaDimension {
  key: string
  label?: string
  type: string
  values: Array<Record<string, unknown>>
  required?: boolean
}

export interface QuotaCell {
  id: number
  scheme: number
  selector: Record<string, unknown>
  label: string
  target: number
  soft_cap: number | null
  weight: number
  achieved: number
  in_progress: number
  reserved: number
  remaining: number
  updated_at: string
}

export interface QuotaStats {
  target: number
  achieved: number
  in_progress: number
  remaining: number
}

export interface QuotaSchemeFilters {
  project?: number
  status?: string
  q?: string
  ordering?: string
  page?: number
  page_size?: number
}

export async function listQuotaSchemes(params: QuotaSchemeFilters) {
  return getPaginated<QuotaScheme>('quota-schemes/', params)
}

export async function createQuotaScheme(payload: Partial<QuotaScheme>) {
  return postJson<QuotaScheme>('quota-schemes/', payload)
}

export async function updateQuotaScheme(id: number, payload: Partial<QuotaScheme>) {
  return patchJson<QuotaScheme>(`quota-schemes/${id}/`, payload)
}

export async function publishQuotaScheme(id: number) {
  return postJson<QuotaScheme>(`quota-schemes/${id}/publish/`, {})
}

export async function archiveQuotaScheme(id: number) {
  return postJson<QuotaScheme>(`quota-schemes/${id}/archive/`, {})
}

export async function getQuotaScheme(id: number) {
  return getJson<QuotaScheme>(`quota-schemes/${id}/`)
}

export async function getQuotaCells(id: number, params: { complete?: boolean } = {}) {
  const query = buildQuery(params)
  return getJson<QuotaCell[]>(`quota-schemes/${id}/cells/${query}`)
}

export async function bulkUpsertQuotaCells(id: number, cells: Partial<QuotaCell>[]) {
  return postJson<QuotaCell[]>(`quota-schemes/${id}/cells/bulk-upsert/`, cells)
}

export async function updateQuotaCell(id: number, payload: Partial<QuotaCell>) {
  return patchJson<QuotaCell>(`quota-cells/${id}/`, payload)
}

export async function getQuotaStats(id: number) {
  return getJson<QuotaStats>(`quota-schemes/${id}/stats/`)
}

export async function getDialerNext(payload: { project: number; scheme_id?: number }) {
  return postJson<{
    assignment_id: number
    expires_at: string
    sample: Record<string, unknown>
    cell: { id: number; label: string }
    scheme: { id: number; name: string }
  }>('quotas/dialer/next', payload)
}

export async function completeDialer(payload: {
  assignment_id: number
  outcome_code: string
  submit_payload?: Record<string, unknown>
}) {
  return postJson('quotas/dialer/complete', payload)
}

export async function cancelDialer(payload: { assignment_id: number }) {
  return postJson('quotas/dialer/cancel', payload)
}
