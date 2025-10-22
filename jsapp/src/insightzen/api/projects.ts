import { deleteResource, getJson, getPaginated, patchJson, postJson } from './client'

export interface InsightZenProject {
  id: number
  code: string
  name: string
  description: string
  owner: number
  owner_name: string
  types: string[]
  status: string
  start_date: string | null
  end_date: string | null
  member_count: number
  created_at: string
  updated_at: string
}

export interface ProjectQueryParams {
  q?: string
  status?: string
  owner_id?: number | ''
  type?: string
  page?: number
  page_size?: number
}

export function fetchProjects(params: ProjectQueryParams) {
  return getPaginated<InsightZenProject>('projects/', params as Record<string, unknown>)
}

export function fetchProject(id: number) {
  return getJson<InsightZenProject>(`projects/${id}/`)
}

export function createProject(payload: Partial<InsightZenProject>) {
  return postJson<InsightZenProject>('projects/', payload)
}

export function updateProject(id: number, payload: Partial<InsightZenProject>) {
  return patchJson<InsightZenProject>(`projects/${id}/`, payload)
}

export function archiveProject(id: number) {
  return deleteResource(`projects/${id}/`)
}
