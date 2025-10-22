import React, { useEffect, useMemo, useState } from 'react'

import { fetchProjects } from '../../api/projects'
import {
  type InsightZenMembership,
  type InsightZenUser,
  createMembership,
  createUser,
  fetchUsers,
} from '../../api/users'
import { InsightZenTable } from '../../components/Table/InsightZenTable'
import { type PermissionMap, PermissionTree } from '../../components/forms/PermissionTree'
import { ROLE_OPTIONS } from '../../constants'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { useInsightZenI18n } from '../../i18n/context'
import formStyles from '../../styles/Forms.module.scss'
import layoutStyles from '../../styles/Layout.module.scss'
import tableStyles from '../../styles/Table.module.scss'

interface ProjectOption {
  id: number
  name: string
}

interface UserFilters {
  q: string
  is_active: '' | 'true' | 'false'
  role: string
  project_id: string
}

const PAGE_SIZES = [20, 50, 100]

function exportUsersToCsv(users: InsightZenUser[], t: (key: string) => string) {
  const header = [
    t('username'),
    t('firstName'),
    t('lastName'),
    t('email'),
    t('phone'),
    t('isActive'),
    t('role'),
    t('project'),
  ]
  const rows = users.map((user) => [
    user.username,
    user.first_name,
    user.last_name,
    user.email,
    user.insight_profile?.phone ?? '',
    user.is_active ? t('active') : t('inactive'),
    user.memberships_brief.map((m) => t(m.role)).join('; '),
    user.memberships_brief.map((m) => m.project_code).join('; '),
  ])
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'insightzen_users.csv'
  anchor.click()
  window.URL.revokeObjectURL(url)
}

interface MembershipDraft extends Partial<InsightZenMembership> {
  project: string
  panel_permissions: PermissionMap
}

function UserFormDrawer({
  open,
  onClose,
  onCreated,
  projects,
}: {
  open: boolean
  onClose: () => void
  onCreated: () => void
  projects: ProjectOption[]
}) {
  const { t } = useInsightZenI18n()
  const [activeTab, setActiveTab] = useState<'profile' | 'memberships'>('profile')
  const [formState, setFormState] = useState({
    username: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    is_active: true,
  })
  const [memberships, setMemberships] = useState<MembershipDraft[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) {
      setFormState({
        username: '',
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        is_active: true,
      })
      setMemberships([])
      setActiveTab('profile')
    }
  }, [open])

  if (!open) {
    return null
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    try {
      const user = await createUser({
        username: formState.username,
        first_name: formState.first_name,
        last_name: formState.last_name,
        email: formState.email,
        is_active: formState.is_active,
        insight_profile: {
          phone: formState.phone,
        },
      })
      for (const membership of memberships) {
        if (!membership.project) continue
        await createMembership(user.id, {
          project: Number(membership.project),
          role: membership.role ?? 'viewer',
          panel_permissions: membership.panel_permissions ?? {},
          title: membership.title ?? '',
        })
      }
      onCreated()
      onClose()
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={formStyles.drawer} role='dialog' aria-modal='true'>
      <div className={formStyles.drawerHeader}>
        <h2>{t('addUser')}</h2>
      </div>
      <form id='insightzen-user-form' className={formStyles.drawerBody} onSubmit={handleSubmit}>
        <div className={formStyles.tabList} role='tablist'>
          <button
            type='button'
            className={`${formStyles.tabButton} ${activeTab === 'profile' ? formStyles.tabButtonActive : ''}`}
            onClick={() => setActiveTab('profile')}
            role='tab'
            aria-selected={activeTab === 'profile'}
          >
            {t('profileTab')}
          </button>
          <button
            type='button'
            className={`${formStyles.tabButton} ${activeTab === 'memberships' ? formStyles.tabButtonActive : ''}`}
            onClick={() => setActiveTab('memberships')}
            role='tab'
            aria-selected={activeTab === 'memberships'}
          >
            {t('membershipsTab')}
          </button>
        </div>

        {activeTab === 'profile' ? (
          <div className={formStyles.fieldGrid}>
            <div className={formStyles.field}>
              <label htmlFor='insightzen-user-username'>{t('username')}</label>
              <input
                id='insightzen-user-username'
                value={formState.username}
                onChange={(event) => setFormState((current) => ({ ...current, username: event.target.value }))}
                required
              />
            </div>
            <div className={formStyles.field}>
              <label htmlFor='insightzen-user-first-name'>{t('firstName')}</label>
              <input
                id='insightzen-user-first-name'
                value={formState.first_name}
                onChange={(event) => setFormState((current) => ({ ...current, first_name: event.target.value }))}
              />
            </div>
            <div className={formStyles.field}>
              <label htmlFor='insightzen-user-last-name'>{t('lastName')}</label>
              <input
                id='insightzen-user-last-name'
                value={formState.last_name}
                onChange={(event) => setFormState((current) => ({ ...current, last_name: event.target.value }))}
              />
            </div>
            <div className={formStyles.field}>
              <label htmlFor='insightzen-user-email'>{t('email')}</label>
              <input
                id='insightzen-user-email'
                type='email'
                value={formState.email}
                onChange={(event) => setFormState((current) => ({ ...current, email: event.target.value }))}
              />
            </div>
            <div className={formStyles.field}>
              <label htmlFor='insightzen-user-phone'>{t('phone')}</label>
              <input
                id='insightzen-user-phone'
                value={formState.phone}
                onChange={(event) => setFormState((current) => ({ ...current, phone: event.target.value }))}
              />
            </div>
            <label className={formStyles.field}>
              <span>{t('isActive')}</span>
              <select
                value={formState.is_active ? 'true' : 'false'}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, is_active: event.target.value === 'true' }))
                }
              >
                <option value='true'>{t('active')}</option>
                <option value='false'>{t('inactive')}</option>
              </select>
            </label>
          </div>
        ) : (
          <div className={formStyles.fieldGrid}>
            <button
              type='button'
              className={layoutStyles.secondaryButton}
              onClick={() =>
                setMemberships((current) => [
                  ...current,
                  {
                    id: Date.now(),
                    project: '',
                    role: 'viewer',
                    panel_permissions: {},
                  },
                ])
              }
            >
              {t('addMembership')}
            </button>
            <div className={formStyles.membershipsList}>
              {memberships.map((membership, index) => (
                <div className={formStyles.membershipCard} key={membership.id ?? index}>
                  <div className={formStyles.membershipHeader}>
                    <span>{`${t('membershipsTab')} #${index + 1}`}</span>
                    <button
                      type='button'
                      className={layoutStyles.secondaryButton}
                      onClick={() => setMemberships((current) => current.filter((_, idx) => idx !== index))}
                    >
                      {t('remove')}
                    </button>
                  </div>
                  <div className={formStyles.field}>
                    <label>{t('project')}</label>
                    <select
                      value={membership.project}
                      onChange={(event) =>
                        setMemberships((current) =>
                          current.map((item, idx) =>
                            idx === index
                              ? {
                                  ...item,
                                  project: event.target.value,
                                }
                              : item,
                          ),
                        )
                      }
                    >
                      <option value=''>{t('projectFilter')}</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={formStyles.field}>
                    <label>{t('role')}</label>
                    <select
                      value={membership.role ?? 'viewer'}
                      onChange={(event) =>
                        setMemberships((current) =>
                          current.map((item, idx) =>
                            idx === index
                              ? {
                                  ...item,
                                  role: event.target.value,
                                }
                              : item,
                          ),
                        )
                      }
                    >
                      {ROLE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {t(option.labelKey)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <PermissionTree
                    value={(membership.panel_permissions as PermissionMap) ?? {}}
                    onChange={(next) =>
                      setMemberships((current) =>
                        current.map((item, idx) =>
                          idx === index
                            ? {
                                ...item,
                                panel_permissions: next,
                              }
                            : item,
                        ),
                      )
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </form>
      <div className={formStyles.drawerFooter}>
        <button type='button' className={layoutStyles.secondaryButton} onClick={onClose} disabled={saving}>
          {t('cancel')}
        </button>
        <button type='submit' className={layoutStyles.primaryButton} form='insightzen-user-form' disabled={saving}>
          {saving ? '…' : t('save')}
        </button>
      </div>
    </div>
  )
}

export default function ListUsersPage() {
  const { t } = useInsightZenI18n()
  const [filters, setFilters] = useState<UserFilters>({
    q: '',
    is_active: '',
    role: '',
    project_id: '',
  })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [data, setData] = useState<InsightZenUser[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const debouncedSearch = useDebouncedValue(filters.q)

  useEffect(() => {
    fetchProjects({ page_size: 100 }).then((response) => {
      setProjects(response.results.map((project) => ({ id: project.id, name: project.name })))
    })
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchUsers({
      q: debouncedSearch,
      is_active: filters.is_active === '' ? undefined : filters.is_active === 'true',
      role: filters.role || undefined,
      project_id: filters.project_id ? Number(filters.project_id) : undefined,
      page,
      page_size: pageSize,
    })
      .then((response) => {
        setData(response.results)
        setCount(response.count)
      })
      .finally(() => setLoading(false))
  }, [debouncedSearch, filters.is_active, filters.role, filters.project_id, page, pageSize, reloadToken])

  const columns = useMemo(
    () => [
      { key: 'username', label: t('username') },
      { key: 'first_name', label: t('firstName') },
      { key: 'last_name', label: t('lastName') },
      { key: 'email', label: t('email') },
      {
        key: 'memberships',
        label: t('project'),
        render: (user: InsightZenUser) => (
          <div className={tableStyles.badgeGroup}>
            {user.memberships_brief.map((membership) => (
              <span key={membership.project_id} className={tableStyles.badge}>
                {membership.project_code}
              </span>
            ))}
          </div>
        ),
      },
      {
        key: 'role',
        label: t('role'),
        render: (user: InsightZenUser) => user.memberships_brief.map((membership) => t(membership.role)).join(', '),
      },
      {
        key: 'is_active',
        label: t('status'),
        render: (user: InsightZenUser) => (user.is_active ? t('active') : t('inactive')),
      },
    ],
    [t],
  )

  const totalPages = Math.max(1, Math.ceil(count / pageSize))

  return (
    <section>
      <div className={layoutStyles.actionsRow}>
        <div className={layoutStyles.controlGroup}>
          <input
            placeholder={t('searchPlaceholder')}
            value={filters.q}
            onChange={(event) => {
              setFilters((current) => ({ ...current, q: event.target.value }))
              setPage(1)
            }}
          />
          <select
            value={filters.is_active}
            onChange={(event) => {
              const nextValue = event.target.value as UserFilters['is_active']
              setFilters((current) => ({ ...current, is_active: nextValue }))
              setPage(1)
            }}
          >
            <option value=''>{t('statusFilter')}</option>
            <option value='true'>{t('active')}</option>
            <option value='false'>{t('inactive')}</option>
          </select>
          <select
            value={filters.role}
            onChange={(event) => {
              setFilters((current) => ({ ...current, role: event.target.value }))
              setPage(1)
            }}
          >
            <option value=''>{t('roleFilter')}</option>
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.labelKey)}
              </option>
            ))}
          </select>
          <select
            value={filters.project_id}
            onChange={(event) => {
              setFilters((current) => ({ ...current, project_id: event.target.value }))
              setPage(1)
            }}
          >
            <option value=''>{t('projectFilter')}</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>
        <div className={layoutStyles.actionButtons}>
          <button type='button' className={layoutStyles.secondaryButton} onClick={() => exportUsersToCsv(data, t)}>
            {t('export')}
          </button>
          <button type='button' className={layoutStyles.primaryButton} onClick={() => setDrawerOpen(true)}>
            {t('addUser')}
          </button>
        </div>
      </div>

      <InsightZenTable
        columns={columns}
        data={data}
        empty={<div className={layoutStyles.notice}>{loading ? '…' : t('emptyUsers')}</div>}
      />
      <div className={layoutStyles.pagination}>
        <span>
          {t('paginationLabel')}: {pageSize}
        </span>
        <select
          value={pageSize}
          onChange={(event) => {
            setPageSize(Number(event.target.value))
            setPage(1)
          }}
        >
          {PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
        <button type='button' onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1}>
          ‹
        </button>
        <span>
          {page} / {totalPages}
        </span>
        <button
          type='button'
          onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
          disabled={page >= totalPages}
        >
          ›
        </button>
      </div>

      <UserFormDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onCreated={() => {
          setDrawerOpen(false)
          setPage(1)
          setReloadToken((value) => value + 1)
        }}
        projects={projects}
      />
    </section>
  )
}
