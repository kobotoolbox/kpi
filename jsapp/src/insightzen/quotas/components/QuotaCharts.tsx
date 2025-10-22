import React, { useMemo } from 'react'

import type { QuotaCell, QuotaDimension } from '../../api/quotas'
import styles from '../../styles/Quota.module.scss'
import { useInsightZenI18n } from '../../i18n/context'

interface QuotaChartsProps {
  cells: QuotaCell[]
  dimensions: QuotaDimension[]
}

export function QuotaCharts({ cells, dimensions }: QuotaChartsProps) {
  const { t } = useInsightZenI18n()
  const summaries = useMemo(() => buildSummaries(cells, dimensions), [cells, dimensions])
  const totals = cells.reduce(
    (acc, cell) => {
      acc.target += cell.target
      acc.achieved += cell.achieved
      return acc
    },
    { target: 0, achieved: 0 },
  )
  const completion = totals.target > 0 ? totals.achieved / totals.target : 0

  return (
    <section className={styles.chartArea} aria-label={t('progressCharts')}>
      <div className={styles.chartBlock}>
        <h3>{t('dimensionProgress')}</h3>
        {summaries.length === 0 ? (
          <p>{t('noDimensionData')}</p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '1rem' }}>
            {summaries.map((summary) => (
              <li key={summary.key}>
                <div style={{ marginBottom: '0.35rem', fontWeight: 600 }}>{summary.label}</div>
                {summary.values.map((item) => (
                  <div key={item.value} style={{ marginBottom: '0.45rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <span>{item.value}</span>
                      <span>
                        {item.achieved}/{item.target}
                      </span>
                    </div>
                    <div style={{ background: '#121212', borderRadius: '999px', height: '10px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${item.target > 0 ? Math.min(100, Math.round((item.achieved / item.target) * 100)) : 0}%`,
                          background: 'linear-gradient(90deg, #4ad, #9af)',
                          height: '100%',
                          transition: 'width 180ms ease',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className={styles.chartBlock}>
        <h3>{t('overallCompletion')}</h3>
        <div style={{ display: 'grid', placeItems: 'center', padding: '1rem' }}>
          <div
            style={{
              width: '180px',
              height: '180px',
              borderRadius: '50%',
              background: `conic-gradient(#6cf ${completion * 360}deg, rgba(255,255,255,0.06) 0deg)`,
              display: 'grid',
              placeItems: 'center',
              position: 'relative',
            }}
            role='img'
            aria-label={t('completionPercent', {
              percent: new Intl.NumberFormat(undefined, {
                style: 'percent',
                maximumFractionDigits: 1,
              }).format(completion),
            })}
          >
            <div
              style={{
                width: '130px',
                height: '130px',
                borderRadius: '50%',
                background: '#050505',
                display: 'grid',
                placeItems: 'center',
                color: '#e8f0ff',
                fontSize: '1.5rem',
                fontWeight: 600,
              }}
            >
              {new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 1 }).format(completion)}
            </div>
          </div>
          <p style={{ marginTop: '1rem' }}>
            {t('achievedLabel', { achieved: totals.achieved.toLocaleString(), target: totals.target.toLocaleString() })}
          </p>
        </div>
      </div>
    </section>
  )
}

interface DimensionSummary {
  key: string
  label: string
  values: Array<{ value: string; achieved: number; target: number }>
}

function buildSummaries(cells: QuotaCell[], dimensions: QuotaDimension[]): DimensionSummary[] {
  return dimensions.slice(0, 3).map((dimension) => {
    const totals = new Map<string, { achieved: number; target: number }>()
    cells.forEach((cell) => {
      const selectorValue = String((cell.selector ?? {})[dimension.key] ?? '—')
      const entry = totals.get(selectorValue) ?? { achieved: 0, target: 0 }
      entry.achieved += cell.achieved
      entry.target += cell.target
      totals.set(selectorValue, entry)
    })
    return {
      key: dimension.key,
      label: dimension.label || dimension.key,
      values: Array.from(totals.entries()).map(([value, entry]) => ({
        value,
        achieved: entry.achieved,
        target: entry.target,
      })),
    }
  })
}
