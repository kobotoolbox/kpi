import React, { useState } from 'react'

import type { QuotaCell } from '../../api/quotas'
import styles from '../../styles/Quota.module.scss'
import { useInsightZenI18n } from '../../i18n/context'

interface BulkEditPanelProps {
  cells: QuotaCell[]
  onApply: (updates: Partial<QuotaCell>) => Promise<void> | void
  onExport: () => void
  onImport: (file: File) => Promise<void>
}

export function BulkEditPanel({ cells, onApply, onExport, onImport }: BulkEditPanelProps) {
  const { t } = useInsightZenI18n()
  const [values, setValues] = useState({ target: '', soft_cap: '', weight: '' })
  const [uploading, setUploading] = useState(false)

  async function handleApply(event: React.FormEvent) {
    event.preventDefault()
    const payload: Partial<QuotaCell> = {}
    if (values.target !== '') {
      payload.target = Number(values.target)
    }
    if (values.soft_cap !== '') {
      payload.soft_cap = Number(values.soft_cap)
    }
    if (values.weight !== '') {
      payload.weight = Number(values.weight)
    }
    if (Object.keys(payload).length > 0) {
      await onApply(payload)
    }
  }

  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }
    setUploading(true)
    try {
      await onImport(file)
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }

  return (
    <section className={styles.bulkPanel} aria-labelledby='bulk-edit-panel'>
      <header>
        <h2 id='bulk-edit-panel'>{t('bulkEdit')}</h2>
        <p>{t('bulkEditHelper')}</p>
      </header>
      <form className={styles.toolbar} onSubmit={handleApply}>
        <label>
          {t('target')}
          <input
            className={styles.toolbarInput}
            type='number'
            min={0}
            value={values.target}
            onChange={(event) => setValues((prev) => ({ ...prev, target: event.target.value }))}
          />
        </label>
        <label>
          {t('softCap')}
          <input
            className={styles.toolbarInput}
            type='number'
            min={0}
            value={values.soft_cap}
            onChange={(event) => setValues((prev) => ({ ...prev, soft_cap: event.target.value }))}
          />
        </label>
        <label>
          {t('weight')}
          <input
            className={styles.toolbarInput}
            type='number'
            min={0}
            step='0.1'
            value={values.weight}
            onChange={(event) => setValues((prev) => ({ ...prev, weight: event.target.value }))}
          />
        </label>
        <button type='submit' className={styles.toolbarButton} disabled={cells.length === 0}>
          {t('applyToAll')}
        </button>
        <button type='button' className={styles.actionButton} onClick={onExport}>
          {t('exportCsv')}
        </button>
        <label className={styles.actionButton} style={{ cursor: 'pointer' }}>
          {uploading ? t('uploading') : t('importCsv')}
          <input type='file' accept='.csv,.xlsx,.xls' onChange={handleImport} style={{ display: 'none' }} />
        </label>
      </form>
    </section>
  )
}
