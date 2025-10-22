import React, { useEffect, useMemo, useState } from 'react'

import { type InsightZenProject, createProject, fetchProjects, updateProject } from '../../api/projects'
import { fetchUsers } from '../../api/users'
import { InsightZenTable } from '../../components/Table/InsightZenTable'
import { STATUS_OPTIONS } from '../../constants'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { useInsightZenI18n } from '../../i18n/context'
import formStyles from '../../styles/Forms.module.scss'
import layoutStyles from '../../styles/Layout.module.scss'
import tableStyles from '../../styles/Table.module.scss'

interface ProjectFilters {
  q: string
  status: string
  owner_id: string
  type: string
}

interface OwnerOption {
  id: number
  name: string
}

const PAGE_SIZES = [20, 50, 100]

function exportProjectsToCsv(projects: InsightZenProject[], t: (key: string) => string) {
  const header = [t('code'), t('name'), t('owner'), t('types'), t('status'), t('startDate'), t('endDate'), t('members')]
  const rows = projects.map((project) => [
    project.code,
    project.name,
    project.owner_name,
    project.types.join('; '),
    t(project.status),
    project.start_date ?? '',
    project.end_date ?? '',
    project.member_count,
  ])
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'insightzen_projects.csv'
  anchor.click()
  window.URL.revokeObjectURL(url)
}

function uniqueTypes(types: string[]): string[] {
  const seen = new Set<string>()
  return types.filter((type) => {
    const normalized = type.trim().toLowerCase()
    if (!normalized || seen.has(normalized)) {
      return false
    }
    seen.add(normalized)
    return true
  })
}

function ProjectFormDrawer({
  open,
  onClose,
  onSaved,
  owners,
  project,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  owners: OwnerOption[]
  project?: InsightZenProject
}) {
  const { t } = useInsightZenI18n()
  const [formState, setFormState] = useState(() => ({
    code: project?.code ?? '',
    name: project?.name ?? '',
    description: project?.description ?? '',
    types: project?.types ?? [],
    status: project?.status ?? 'active',
    start_date: project?.start_date ?? '',
    end_date: project?.end_date ?? '',
    owner: project?.owner ? String(project.owner) : '',
  }))
  const [typeInput, setTypeInput] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (project) {
      setFormState({
        code: project.code,
        name: project.name,
        description: project.description,
        types: project.types,
        status: project.status,
        start_date: project.start_date ?? '',
        end_date: project.end_date ?? '',
        owner: project.owner ? String(project.owner) : '',
      })
    }
  }, [project])

  useEffect(() => {
    if (!open && !project) {
      setFormState({
        code: '',
        name: '',
        description: '',
        types: [],
        status: 'active',
        start_date: '',
        end_date: '',
        owner: '',
      })
      setTypeInput('')
    }
  }, [open, project])

  useEffect(() => {
    if (open && !project && !formState.owner && owners.length) {
      setFormState((current) => ({ ...current, owner: String(owners[0].id) }))
    }
  }, [open, project, formState.owner, owners])

  if (!open) {
    return null
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    try {
      const payload = {
        ...formState,
        types: uniqueTypes(formState.types),
        start_date: formState.start_date || null,
        end_date: formState.end_date || null,
        owner: formState.owner ? Number(formState.owner) : undefined,
      }
      if (project) {
        await updateProject(project.id, payload)
      } else {
        await createProject(payload)
      }
      onSaved()
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
        <h2>{project ? t('projectManagement') : t('addProject')}</h2>
      </div>
      <form id='insightzen-project-form' className={formStyles.drawerBody} onSubmit={handleSubmit}>
        <div className={formStyles.fieldGrid}>
          <div className={formStyles.field}>
            <label htmlFor='insightzen-project-code'>{t('code')}</label>
            <input
              id='insightzen-project-code'
              required
              value={formState.code}
              onChange={(event) => setFormState((current) => ({ ...current, code: event.target.value }))}
            />
          </div>
          <div className={formStyles.field}>
            <label htmlFor='insightzen-project-name'>{t('name')}</label>
            <input
              id='insightzen-project-name'
              required
              value={formState.name}
              onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))}
            />
          </div>
          <div className={formStyles.field}>
            <label htmlFor='insightzen-project-owner'>{t('owner')}</label>
            <select
              id='insightzen-project-owner'
              required
              value={formState.owner}
              disabled={!owners.length}
              onChange={(event) => setFormState((current) => ({ ...current, owner: event.target.value }))}
            >
              <option value=''>{t('owner')}</option>
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.name}
                </option>
              ))}
            </select>
          </div>
          <div className={formStyles.field}>
            <label htmlFor='insightzen-project-description'>{t('description')}</label>
            <textarea
              id='insightzen-project-description'
              value={formState.description}
              onChange={(event) => setFormState((current) => ({ ...current, description: event.target.value }))}
            />
          </div>
          <div className={formStyles.field}>
            <label>{t('types')}</label>
            <div className={layoutStyles.controlGroup}>
              <input
                value={typeInput}
                onChange={(event) => setTypeInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    if (typeInput.trim()) {
                      setFormState((current) => ({
                        ...current,
                        types: uniqueTypes([...current.types, typeInput.trim()]),
                      }))
                      setTypeInput('')
                    }
                  }
                }}
              />
              <button
                type='button'
                className={layoutStyles.secondaryButton}
                onClick={() => {
                  if (typeInput.trim()) {
                    setFormState((current) => ({
                      ...current,
                      types: uniqueTypes([...current.types, typeInput.trim()]),
                    }))
                    setTypeInput('')
                  }
                }}
              >
                {t('addType')}
              </button>
            </div>
            <div className={tableStyles.badgeGroup}>
              {formState.types.map((type) => (
                <span key={type} className={tableStyles.badge}>
                  {type}
                </span>
              ))}
            </div>
          </div>
          <div className={formStyles.field}>
            <label>{t('status')}</label>
            <select
              value={formState.status}
              onChange={(event) => setFormState((current) => ({ ...current, status: event.target.value }))}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </option>
              ))}
            </select>
          </div>
          <div className={formStyles.field}>
            <label htmlFor='insightzen-project-start'>{t('startDate')}</label>
            <input
              id='insightzen-project-start'
              type='date'
              value={formState.start_date}
              onChange={(event) => setFormState((current) => ({ ...current, start_date: event.target.value }))}
            />
          </div>
          <div className={formStyles.field}>
            <label htmlFor='insightzen-project-end'>{t('endDate')}</label>
            <input
              id='insightzen-project-end'
              type='date'
              value={formState.end_date}
              onChange={(event) => setFormState((current) => ({ ...current, end_date: event.target.value }))}
            />
          </div>
        </div>
      </form>
      <div className={formStyles.drawerFooter}>
        <button type='button' className={layoutStyles.secondaryButton} onClick={onClose} disabled={saving}>
          {t('cancel')}
        </button>
        <button type='submit' className={layoutStyles.primaryButton} form='insightzen-project-form' disabled={saving}>
          {saving ? '…' : t('save')}
        </button>
      </div>
    </div>
  )
}

export default function ListProjectsPage() {
  const { t } = useInsightZenI18n()
  const [filters, setFilters] = useState<ProjectFilters>({
    q: '',
    status: '',
    owner_id: '',
    type: '',
  })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [data, setData] = useState<InsightZenProject[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)
  const [owners, setOwners] = useState<OwnerOption[]>([])
  const debouncedSearch = useDebouncedValue(filters.q)

  useEffect(() => {
    fetchUsers({ page_size: 100 })
      .then((response) => {
        setOwners(
          response.results.map((user) => ({
            id: user.id,
            name:
              user.first_name || user.last_name
                ? `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || user.username
                : user.username,
          })),
        )
      })
      .catch(() => {
        setOwners([])
      })
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchProjects({
      q: debouncedSearch,
      status: filters.status || undefined,
      owner_id: filters.owner_id ? Number(filters.owner_id) : undefined,
      type: filters.type || undefined,
      page,
      page_size: pageSize,
    })
      .then((response) => {
        setData(response.results)
        setCount(response.count)
      })
      .finally(() => setLoading(false))
  }, [debouncedSearch, filters.status, filters.owner_id, filters.type, page, pageSize, reloadToken])

  const columns = useMemo(
    () => [
      { key: 'code', label: t('code') },
      { key: 'name', label: t('name') },
      { key: 'owner_name', label: t('owner') },
      {
        key: 'types',
        label: t('types'),
        render: (project: InsightZenProject) => (
          <div className={tableStyles.badgeGroup}>
            {project.types.map((type) => (
              <span key={type} className={tableStyles.badge}>
                {type}
              </span>
            ))}
          </div>
        ),
      },
      {
        key: 'status',
        label: t('status'),
        render: (project: InsightZenProject) => t(project.status),
      },
      {
        key: 'member_count',
        label: t('members'),
        render: (project: InsightZenProject) => project.member_count,
        className: tableStyles.numeric,
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
            value={filters.status}
            onChange={(event) => {
              setFilters((current) => ({ ...current, status: event.target.value }))
              setPage(1)
            }}
          >
            <option value=''>{t('statusFilter')}</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.labelKey)}
              </option>
            ))}
          </select>
          <select
            value={filters.owner_id}
            onChange={(event) => {
              setFilters((current) => ({ ...current, owner_id: event.target.value }))
              setPage(1)
            }}
          >
            <option value=''>{t('owner')}</option>
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.name}
              </option>
            ))}
          </select>
          <input
            placeholder={t('types')}
            value={filters.type}
            onChange={(event) => {
              setFilters((current) => ({ ...current, type: event.target.value }))
              setPage(1)
            }}
          />
        </div>
        <div className={layoutStyles.actionButtons}>
          <button type='button' className={layoutStyles.secondaryButton} onClick={() => exportProjectsToCsv(data, t)}>
            {t('export')}
          </button>
          <button type='button' className={layoutStyles.primaryButton} onClick={() => setDrawerOpen(true)}>
            {t('addProject')}
          </button>
        </div>
      </div>

      <InsightZenTable
        columns={columns}
        data={data}
        empty={<div className={layoutStyles.notice}>{loading ? '…' : t('emptyProjects')}</div>}
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

      <ProjectFormDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSaved={() => {
          setDrawerOpen(false)
          setPage(1)
          setReloadToken((value) => value + 1)
        }}
        owners={owners}
      />
    </section>
  )
}
