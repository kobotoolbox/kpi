import React, { useMemo, useState } from 'react'

import type { QuotaDimension } from '../../api/quotas'
import styles from '../../styles/Quota.module.scss'
import { useInsightZenI18n } from '../../i18n/context'

type DimensionDraft = QuotaDimension & { id: string }

function toDraft(dimensions: QuotaDimension[]): DimensionDraft[] {
  return dimensions.map((dimension, index) => ({
    ...dimension,
    id: `${dimension.key}-${index}`,
  }))
}

interface DimensionsBuilderProps {
  value: QuotaDimension[]
  onChange: (dimensions: QuotaDimension[]) => void
}

export function DimensionsBuilder({ value, onChange }: DimensionsBuilderProps) {
  const { t } = useInsightZenI18n()
  const [drafts, setDrafts] = useState<DimensionDraft[]>(() => toDraft(value))

  useMemo(() => {
    setDrafts(toDraft(value))
  }, [value])

  function updateDraft(index: number, updates: Partial<DimensionDraft>) {
    setDrafts((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], ...updates }
      onChange(next.map(({ id, ...dimension }) => dimension))
      return next
    })
  }

  function addDimension() {
    setDrafts((prev) => {
      const next: DimensionDraft[] = [
        ...prev,
        {
          id: `dim-${Date.now()}`,
          key: '',
          label: '',
          type: 'categorical',
          values: [],
          required: true,
        },
      ]
      return next
    })
  }

  function removeDimension(index: number) {
    setDrafts((prev) => {
      const next = prev.filter((_, idx) => idx !== index)
      onChange(next.map(({ id, ...dimension }) => dimension))
      return next
    })
  }

  function handleValuesChange(index: number, raw: string) {
    const values = raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((value) => ({ value }))
    updateDraft(index, { values })
  }

  return (
    <section className={styles.bulkPanel} aria-labelledby='dimensions-builder-title'>
      <header>
        <h2 id='dimensions-builder-title'>{t('dimensions')}</h2>
        <p>{t('dimensionsHelper')}</p>
      </header>
      {drafts.map((dimension, index) => (
        <div key={dimension.id} className={styles.notice}>
          <div className={styles.toolbar}>
            <label>
              {t('dimensionKey')}
              <input
                className={styles.toolbarInput}
                value={dimension.key}
                onChange={(event) => updateDraft(index, { key: event.target.value })}
              />
            </label>
            <label>
              {t('dimensionLabel')}
              <input
                className={styles.toolbarInput}
                value={dimension.label ?? ''}
                onChange={(event) => updateDraft(index, { label: event.target.value })}
              />
            </label>
            <label>
              {t('dimensionType')}
              <select
                className={styles.toolbarSelect}
                value={dimension.type}
                onChange={(event) => updateDraft(index, { type: event.target.value })}
              >
                <option value='categorical'>{t('categorical')}</option>
                <option value='numeric'>{t('numeric')}</option>
                <option value='text'>{t('text')}</option>
              </select>
            </label>
            <label>
              {t('required')}
              <select
                className={styles.toolbarSelect}
                value={dimension.required ? 'true' : 'false'}
                onChange={(event) => updateDraft(index, { required: event.target.value === 'true' })}
              >
                <option value='true'>{t('yes')}</option>
                <option value='false'>{t('no')}</option>
              </select>
            </label>
            <button type='button' className={styles.actionButton} onClick={() => removeDimension(index)}>
              {t('remove')}
            </button>
          </div>
          <label>
            {t('dimensionValues')}
            <textarea
              className={styles.toolbarInput}
              style={{ minHeight: '120px' }}
              value={dimension.values.map((value) => String((value as any).value ?? value)).join('\n')}
              onChange={(event) => handleValuesChange(index, event.target.value)}
            />
          </label>
        </div>
      ))}
      <button type='button' className={styles.toolbarButton} onClick={addDimension}>
        {t('addDimension')}
      </button>
    </section>
  )
}
