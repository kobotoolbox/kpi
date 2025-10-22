import React, { useEffect, useMemo, useState } from 'react'

import { useNavigate } from 'react-router-dom'

import { fetchProjects } from '../../api/projects'
import {
  archiveQuotaScheme,
  createQuotaScheme,
  listQuotaSchemes,
  publishQuotaScheme,
  type QuotaScheme,
} from '../../api/quotas'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { useInsightZenI18n } from '../../i18n/context'
import quotaStyles from '../../styles/Quota.module.scss'

interface ProjectOption {
  id: number
  name: string
}

const PAGE_SIZES = [20, 50, 100]

export default function SchemesListPage() {
  const { t } = useInsightZenI18n()
  const navigate = useNavigate()
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [schemes, setSchemes] = useState<QuotaScheme[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', project: '', priority: 0, is_default: true })
  const [filters, setFilters] = useState({ project: '', status: '', q: '' })
  const [reloadKey, setReloadKey] = useState(0)
  const debouncedSearch = useDebouncedValue(filters.q, 400)

  useEffect(() => {
    async function loadProjects() {
      const response = await fetchProjects({ page_size: 100 })
      setProjects(response.results.map((project) => ({ id: project.id, name: project.name })))
    }
    loadProjects()
  }, [])

  useEffect(() => {
    async function loadSchemes() {
      setLoading(true)
      try {
        const response = await listQuotaSchemes({
          page,
          page_size: pageSize,
          status: filters.status || undefined,
          project: filters.project ? Number(filters.project) : undefined,
          q: debouncedSearch || undefined,
          ordering: '-priority,-created_at',
        })
        setSchemes(response.results)
        setCount(response.count)
      } finally {
        setLoading(false)
      }
    }
    loadSchemes()
  }, [page, pageSize, filters.project, filters.status, debouncedSearch, reloadKey])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(count / pageSize)), [count, pageSize])

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault()
    setCreating(true)
    try {
      const scheme = await createQuotaScheme({
        name: form.name,
        project: Number(form.project),
        priority: Number(form.priority),
        is_default: form.is_default,
        dimensions: [],
      })
      navigate(`/insightzen/quota-management/${scheme.id}`)
    } finally {
      setCreating(false)
    }
  }

  async function handlePublish(scheme: QuotaScheme) {
    await publishQuotaScheme(scheme.id)
    refreshCurrentPage()
  }

  async function handleArchive(scheme: QuotaScheme) {
    await archiveQuotaScheme(scheme.id)
    refreshCurrentPage()
  }

  function refreshCurrentPage() {
    setReloadKey((prev) => prev + 1)
  }

  return (
    <div className={quotaStyles.quotaWorkspace}>
      <section className={quotaStyles.gridWrapper}>
        <div className={quotaStyles.gridHeader}>
          <h1>{t('quotaManagement')}</h1>
          <div className={quotaStyles.gridTabs}>
            <label>
              {t('project')}
              <select
                className={quotaStyles.toolbarSelect}
                value={filters.project}
                onChange={(event) => {
                  setPage(1)
                  setFilters((prev) => ({ ...prev, project: event.target.value }))
                }}
              >
                <option value=''>{t('allProjects')}</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('status')}
              <select
                className={quotaStyles.toolbarSelect}
                value={filters.status}
                onChange={(event) => {
                  setPage(1)
                  setFilters((prev) => ({ ...prev, status: event.target.value }))
                }}
              >
                <option value=''>{t('allStatuses')}</option>
                <option value='draft'>{t('draft')}</option>
                <option value='published'>{t('published')}</option>
                <option value='archived'>{t('archived')}</option>
              </select>
            </label>
            <label>
              {t('search')}
              <input
                className={quotaStyles.toolbarInput}
                value={filters.q}
                onChange={(event) => {
                  setPage(1)
                  setFilters((prev) => ({ ...prev, q: event.target.value }))
                }}
              />
            </label>
          </div>
        </div>
        <div className={quotaStyles.gridContent}>
          <form className={quotaStyles.notice} onSubmit={handleCreate}>
            <h2>{t('createScheme')}</h2>
            <div className={quotaStyles.toolbar}>
              <label>
                {t('schemeName')}
                <input
                  className={quotaStyles.toolbarInput}
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  required
                />
              </label>
              <label>
                {t('project')}
                <select
                  className={quotaStyles.toolbarSelect}
                  value={form.project}
                  onChange={(event) => setForm((prev) => ({ ...prev, project: event.target.value }))}
                  required
                >
                  <option value=''>{t('selectProject')}</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t('priority')}
                <input
                  className={quotaStyles.toolbarInput}
                  type='number'
                  value={form.priority}
                  onChange={(event) => setForm((prev) => ({ ...prev, priority: Number(event.target.value) }))}
                />
              </label>
              <label>
                {t('defaultScheme')}
                <select
                  className={quotaStyles.toolbarSelect}
                  value={form.is_default ? 'true' : 'false'}
                  onChange={(event) => setForm((prev) => ({ ...prev, is_default: event.target.value === 'true' }))}
                >
                  <option value='true'>{t('yes')}</option>
                  <option value='false'>{t('no')}</option>
                </select>
              </label>
              <button type='submit' className={quotaStyles.toolbarButton} disabled={creating}>
                {creating ? t('creating') : t('create')}
              </button>
            </div>
          </form>

          <div>
            <div className={quotaStyles.tableContainer}>
              <table className={quotaStyles.schemeTable}>
                <thead>
                  <tr>
                    <th>{t('name')}</th>
                    <th>{t('project')}</th>
                    <th>{t('version')}</th>
                    <th>{t('priority')}</th>
                    <th>{t('status')}</th>
                    <th>{t('cells')}</th>
                    <th>{t('createdAt')}</th>
                    <th>{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={8}>{t('loading')}</td>
                    </tr>
                  ) : schemes.length === 0 ? (
                    <tr>
                      <td colSpan={8}>{t('noSchemes')}</td>
                    </tr>
                  ) : (
                    schemes.map((scheme) => (
                      <tr key={scheme.id}>
                        <td>{scheme.name}</td>
                        <td>{scheme.project_code}</td>
                        <td>{scheme.version}</td>
                        <td>{scheme.priority}</td>
                        <td>
                          <span className={quotaStyles.statusBadge}>
                            {scheme.is_default ? '★' : null} {t(scheme.status)}
                          </span>
                        </td>
                        <td>{scheme.cell_count}</td>
                        <td>{new Date(scheme.created_at).toLocaleString()}</td>
                        <td>
                          <div className={quotaStyles.actions}>
                            <button
                              type='button'
                              className={quotaStyles.actionButton}
                              onClick={() => navigate(`/insightzen/quota-management/${scheme.id}`)}
                            >
                              {t('open')}
                            </button>
                            {scheme.status !== 'published' && scheme.status !== 'archived' ? (
                              <button
                                type='button'
                                className={quotaStyles.actionButton}
                                onClick={() => handlePublish(scheme)}
                              >
                                {t('publish')}
                              </button>
                            ) : null}
                            {scheme.status !== 'archived' ? (
                              <button
                                type='button'
                                className={quotaStyles.actionButton}
                                onClick={() => handleArchive(scheme)}
                              >
                                {t('archive')}
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <footer className={quotaStyles.toolbar}>
              <div>
                {t('pageOf', { page, totalPages })}
                <button
                  type='button'
                  className={quotaStyles.actionButton}
                  disabled={page <= 1}
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                >
                  {t('previous')}
                </button>
                <button
                  type='button'
                  className={quotaStyles.actionButton}
                  disabled={page >= totalPages}
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                >
                  {t('next')}
                </button>
              </div>
              <label>
                {t('pageSize')}
                <select
                  className={quotaStyles.toolbarSelect}
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
              </label>
            </footer>
          </div>
        </div>
      </section>
    </div>
  )
}
