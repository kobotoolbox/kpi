import React, { useEffect, useMemo, useState } from 'react'

import { useNavigate, useParams } from 'react-router-dom'

import {
  bulkUpsertQuotaCells,
  getQuotaCells,
  getQuotaScheme,
  getQuotaStats,
  type QuotaCell,
  type QuotaDimension,
  type QuotaScheme,
  type QuotaStats,
  publishQuotaScheme,
  updateQuotaCell,
  updateQuotaScheme,
} from '../../api/quotas'
import { DimensionsBuilder } from '../../quotas/components/DimensionsBuilder'
import { CellsPivotGrid } from '../../quotas/components/CellsPivotGrid'
import { BulkEditPanel } from '../../quotas/components/BulkEditPanel'
import { SchemeKPI } from '../../quotas/components/SchemeKPI'
import { QuotaCharts } from '../../quotas/components/QuotaCharts'
import { useInsightZenI18n } from '../../i18n/context'
import quotaStyles from '../../styles/Quota.module.scss'

export default function SchemeEditorPage() {
  const { t } = useInsightZenI18n()
  const navigate = useNavigate()
  const params = useParams()
  const schemeId = Number(params.schemeId)
  const [scheme, setScheme] = useState<QuotaScheme | null>(null)
  const [cells, setCells] = useState<QuotaCell[]>([])
  const [stats, setStats] = useState<QuotaStats | null>(null)
  const [dimensions, setDimensions] = useState<QuotaDimension[]>([])
  const [activeTab, setActiveTab] = useState<'design' | 'progress' | 'import'>('design')
  const [loading, setLoading] = useState(true)
  const [savingDimensions, setSavingDimensions] = useState(false)
  const isReadOnly = scheme?.status === 'published' || scheme?.status === 'archived'

  useEffect(() => {
    async function boot() {
      setLoading(true)
      try {
        const [schemeData, cellData, statsData] = await Promise.all([
          getQuotaScheme(schemeId),
          getQuotaCells(schemeId),
          getQuotaStats(schemeId),
        ])
        setScheme(schemeData)
        setDimensions(schemeData.dimensions)
        setCells(cellData)
        setStats(statsData)
      } finally {
        setLoading(false)
      }
    }
    if (!Number.isFinite(schemeId)) {
      navigate('/insightzen/quota-management')
      return
    }
    boot()
  }, [schemeId, navigate])

  const canEditDimensions = scheme?.status === 'draft'

  const sortedCells = useMemo(
    () =>
      [...cells].sort((a, b) => {
        if (a.achieved === b.achieved) {
          return a.target - b.target
        }
        return a.achieved - b.achieved
      }),
    [cells],
  )

  async function handleCellUpdate(cellId: number, updates: Partial<QuotaCell>) {
    if (isReadOnly) {
      return
    }
    await updateQuotaCell(cellId, updates)
    const updatedCells = await getQuotaCells(schemeId)
    setCells(updatedCells)
    setStats(await getQuotaStats(schemeId))
  }

  async function handleBulkApply(updates: Partial<QuotaCell>) {
    if (isReadOnly) {
      return
    }
    const payload = sortedCells.map((cell) => ({
      selector: cell.selector,
      label: cell.label,
      target: updates.target ?? cell.target,
      soft_cap: updates.soft_cap ?? cell.soft_cap,
      weight: updates.weight ?? cell.weight,
    }))
    await bulkUpsertQuotaCells(schemeId, payload)
    const [cellData, statsData] = await Promise.all([getQuotaCells(schemeId), getQuotaStats(schemeId)])
    setCells(cellData)
    setStats(statsData)
  }

  async function handleImport(file: File) {
    const text = await file.text()
    const rows = text.split(/\r?\n/).filter(Boolean)
    if (rows.length < 2) {
      return
    }
    const headers = rows[0].split(',').map((header) => header.trim())
    const selectorKeys = headers.filter((header) => !['target', 'soft_cap', 'weight', 'label'].includes(header))
    const payload = rows.slice(1).map((row) => {
      const values = row.split(',')
      const record: Record<string, string> = {}
      headers.forEach((header, index) => {
        record[header] = values[index]?.trim() ?? ''
      })
      const selector: Record<string, string> = {}
      selectorKeys.forEach((key) => {
        if (record[key]) {
          selector[key] = record[key]
        }
      })
      return {
        selector,
        label: record.label,
        target: Number(record.target || 0),
        soft_cap: record.soft_cap ? Number(record.soft_cap) : null,
        weight: record.weight ? Number(record.weight) : 1,
      }
    })
    await bulkUpsertQuotaCells(schemeId, payload)
    const [cellData, statsData] = await Promise.all([getQuotaCells(schemeId), getQuotaStats(schemeId)])
    setCells(cellData)
    setStats(statsData)
  }

  function handleExport() {
    const header = [...dimensions.map((dimension) => dimension.key), 'label', 'target', 'soft_cap', 'weight']
    const rows = cells.map((cell) => {
      const selectorValues = dimensions.map((dimension) => String((cell.selector ?? {})[dimension.key] ?? ''))
      return [
        ...selectorValues,
        cell.label ?? '',
        String(cell.target ?? ''),
        cell.soft_cap != null ? String(cell.soft_cap) : '',
        String(cell.weight ?? ''),
      ]
    })
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `quota_cells_${schemeId}.csv`
    anchor.click()
    window.URL.revokeObjectURL(url)
  }

  async function handleDimensionsSave() {
    if (!scheme) {
      return
    }
    setSavingDimensions(true)
    try {
      const updated = await updateQuotaScheme(scheme.id, { dimensions })
      setScheme(updated)
    } finally {
      setSavingDimensions(false)
    }
  }

  async function handlePublish() {
    if (!scheme) {
      return
    }
    const published = await publishQuotaScheme(scheme.id)
    setScheme(published)
  }

  if (loading || !scheme) {
    return <div className={quotaStyles.quotaWorkspace}>{t('loading')}</div>
  }

  return (
    <div className={quotaStyles.quotaWorkspace}>
      <header className={quotaStyles.gridHeader}>
        <div>
          <button type='button' className={quotaStyles.actionButton} onClick={() => navigate('/insightzen/quota-management')}>
            {t('back')}
          </button>
          <h1>{scheme.name}</h1>
        </div>
        <div className={quotaStyles.gridTabs}>
          <button
            type='button'
            className={`${quotaStyles.gridTab} ${activeTab === 'design' ? quotaStyles.gridTabActive : ''}`}
            onClick={() => setActiveTab('design')}
          >
            {t('design')}
          </button>
          <button
            type='button'
            className={`${quotaStyles.gridTab} ${activeTab === 'progress' ? quotaStyles.gridTabActive : ''}`}
            onClick={() => setActiveTab('progress')}
          >
            {t('progress')}
          </button>
          <button
            type='button'
            className={`${quotaStyles.gridTab} ${activeTab === 'import' ? quotaStyles.gridTabActive : ''}`}
            onClick={() => setActiveTab('import')}
          >
            {t('importExport')}
          </button>
        </div>
        <div className={quotaStyles.actions}>
          {scheme.status !== 'published' ? (
            <button type='button' className={quotaStyles.toolbarButton} onClick={handlePublish}>
              {t('publish')}
            </button>
          ) : null}
        </div>
      </header>
      <main className={quotaStyles.gridContent}>
        {activeTab === 'design' ? (
          <>
            <div style={canEditDimensions ? undefined : { opacity: 0.6, pointerEvents: 'none' }}>
              <DimensionsBuilder value={dimensions} onChange={setDimensions} />
            </div>
            {canEditDimensions ? (
              <button
                type='button'
                className={quotaStyles.toolbarButton}
                onClick={handleDimensionsSave}
                disabled={savingDimensions}
              >
                {savingDimensions ? t('saving') : t('saveDimensions')}
              </button>
            ) : (
              <p className={quotaStyles.notice}>{t('dimensionsLocked')}</p>
            )}
            {isReadOnly ? <p className={quotaStyles.notice}>{t('readOnlyScheme')}</p> : null}
            <div style={isReadOnly ? { opacity: 0.6, pointerEvents: 'none' } : undefined}>
              <CellsPivotGrid cells={sortedCells} dimensions={dimensions} onCellUpdate={handleCellUpdate} />
            </div>
            <div style={isReadOnly ? { opacity: 0.6, pointerEvents: 'none' } : undefined}>
              <BulkEditPanel
                cells={sortedCells}
                onApply={handleBulkApply}
                onExport={handleExport}
                onImport={handleImport}
              />
            </div>
          </>
        ) : null}
        {activeTab === 'progress' ? (
          <>
            <SchemeKPI stats={stats} />
            <QuotaCharts cells={sortedCells} dimensions={dimensions} />
          </>
        ) : null}
        {activeTab === 'import' ? (
          <div className={quotaStyles.notice}>
            <h2>{t('importExportHelper')}</h2>
            <p>{t('importHint')}</p>
            <BulkEditPanel cells={sortedCells} onApply={handleBulkApply} onExport={handleExport} onImport={handleImport} />
          </div>
        ) : null}
      </main>
    </div>
  )
}
