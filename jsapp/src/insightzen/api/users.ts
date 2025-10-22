import { deleteResource, getJson, getPaginated, patchJson, postJson } from './client'

export interface InsightZenProfile {
  phone?: string
  preferred_locale?: 'fa' | 'en'
  timezone?: string
}

export interface InsightZenMembershipBrief {
  project_id: number
  project_code: string
  role: string
}

export interface InsightZenMembership extends InsightZenMembershipBrief {
  id: number
  title: string
  panel_permissions: Record<string, unknown>
  is_active: boolean
  created_at: string
  user: number
}

export interface InsightZenUser {
  id: number
  username: string
  first_name: string
  last_name: string
  email: string
  is_active: boolean
  is_staff: boolean
  insight_profile?: InsightZenProfile | null
  memberships_brief: InsightZenMembershipBrief[]
}

export interface InsightZenUserDetail extends InsightZenUser {
  memberships: InsightZenMembership[]
}

export interface UserQueryParams {
  q?: string
  is_active?: boolean | ''
  role?: string
  project_id?: number | ''
  page?: number
  page_size?: number
}

export function fetchUsers(params: UserQueryParams) {
  return getPaginated<InsightZenUser>('users/', params as Record<string, unknown>)
}

export function fetchUser(id: number) {
  return getJson<InsightZenUserDetail>(`users/${id}/`)
}

export function createUser(payload: Partial<InsightZenUser>) {
  return postJson<InsightZenUser>('users/', payload)
}

export function updateUser(id: number, payload: Partial<InsightZenUser>) {
  return patchJson<InsightZenUser>(`users/${id}/`, payload)
}

export function deactivateUser(id: number) {
  return deleteResource(`users/${id}/`)
}

export function createMembership(userId: number, payload: Partial<InsightZenMembership> & { project: number }) {
  return postJson<InsightZenMembership>(`users/${userId}/memberships/`, payload)
}

export function updateMembership(userId: number, membershipId: number, payload: Partial<InsightZenMembership>) {
  return patchJson<InsightZenMembership>(`users/${userId}/memberships/${membershipId}/`, payload)
}

export function deleteMembership(userId: number, membershipId: number) {
  return deleteResource(`users/${userId}/memberships/${membershipId}/`)
}
