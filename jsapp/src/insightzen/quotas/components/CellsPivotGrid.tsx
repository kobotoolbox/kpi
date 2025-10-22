import React, { useEffect, useState } from 'react'

import type { QuotaCell, QuotaDimension } from '../../api/quotas'
import styles from '../../styles/Quota.module.scss'
import { useInsightZenI18n } from '../../i18n/context'

interface CellsPivotGridProps {
  cells: QuotaCell[]
  dimensions: QuotaDimension[]
  onCellUpdate: (cellId: number, updates: Partial<QuotaCell>) => Promise<void> | void
}

interface EditableCellState {
  target: number
  soft_cap: number | null
  weight: number
}

export function CellsPivotGrid({ cells, dimensions, onCellUpdate }: CellsPivotGridProps) {
  const { t } = useInsightZenI18n()
  const [pending, setPending] = useState<Record<number, boolean>>({})
  const [edits, setEdits] = useState<Record<number, EditableCellState>>(() => mapEdits(cells))

  useEffect(() => {
    setEdits(mapEdits(cells))
  }, [cells])

  function mapEdits(source: QuotaCell[]): Record<number, EditableCellState> {
    return source.reduce<Record<number, EditableCellState>>((acc, cell) => {
      acc[cell.id] = {
        target: cell.target,
        soft_cap: cell.soft_cap,
        weight: cell.weight,
      }
      return acc
    }, {})
  }

  async function commitChange(cell: QuotaCell, field: keyof EditableCellState, value: number | null) {
    setEdits((prev) => ({
      ...prev,
      [cell.id]: { ...prev[cell.id], [field]: value },
    }))
    setPending((prev) => ({ ...prev, [cell.id]: true }))
    try {
      await onCellUpdate(cell.id, {
        [field]: value,
      } as Partial<QuotaCell>)
    } finally {
      setPending((prev) => ({ ...prev, [cell.id]: false }))
    }
  }

  const headers = dimensions.map((dimension) => dimension.label || dimension.key)

  return (
    <div className={styles.pivotContainer} role='region' aria-live='polite'>
      <table className={styles.pivotTable}>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
            <th>{t('target')}</th>
            <th>{t('softCap')}</th>
            <th>{t('weight')}</th>
            <th>{t('achieved')}</th>
            <th>{t('inProgress')}</th>
            <th>{t('remaining')}</th>
            <th>{t('status')}</th>
          </tr>
        </thead>
        <tbody>
          {cells.map((cell) => {
            const edit = edits[cell.id]
            return (
              <tr key={cell.id}>
                {dimensions.map((dimension) => (
                  <td key={`${cell.id}-${dimension.key}`}>
                    {String((cell.selector ?? {})[dimension.key] ?? t('unassigned'))}
                  </td>
                ))}
                <td>
                  <input
                    className={styles.inlineInput}
                    type='number'
                    min={0}
                    value={edit?.target ?? cell.target}
                    onChange={(event) =>
                      setEdits((prev) => ({
                        ...prev,
                        [cell.id]: {
                          ...prev[cell.id],
                          target: Number(event.target.value),
                          soft_cap: prev[cell.id]?.soft_cap ?? cell.soft_cap,
                          weight: prev[cell.id]?.weight ?? cell.weight,
                        },
                      }))
                    }
                    onBlur={(event) => commitChange(cell, 'target', Number(event.target.value))}
                    aria-label={`${t('target')} ${JSON.stringify(cell.selector)}`}
                  />
                </td>
                <td>
                  <input
                    className={styles.inlineInput}
                    type='number'
                    min={0}
                    value={edit?.soft_cap ?? cell.soft_cap ?? ''}
                    onChange={(event) =>
                      setEdits((prev) => ({
                        ...prev,
                        [cell.id]: {
                          ...prev[cell.id],
                          soft_cap: event.target.value === '' ? null : Number(event.target.value),
                        },
                      }))
                    }
                    onBlur={(event) =>
                      commitChange(
                        cell,
                        'soft_cap',
                        event.target.value === '' ? null : Number(event.target.value),
                      )
                    }
                    aria-label={`${t('softCap')} ${JSON.stringify(cell.selector)}`}
                  />
                </td>
                <td>
                  <input
                    className={styles.inlineInput}
                    type='number'
                    min={0}
                    step='0.1'
                    value={edit?.weight ?? cell.weight}
                    onChange={(event) =>
                      setEdits((prev) => ({
                        ...prev,
                        [cell.id]: {
                          ...prev[cell.id],
                          weight: Number(event.target.value),
                        },
                      }))
                    }
                    onBlur={(event) => commitChange(cell, 'weight', Number(event.target.value))}
                    aria-label={`${t('weight')} ${JSON.stringify(cell.selector)}`}
                  />
                </td>
                <td>{cell.achieved}</td>
                <td>{cell.in_progress}</td>
                <td>{cell.remaining}</td>
                <td>{pending[cell.id] ? t('saving') : ''}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {cells.length === 0 ? <div className={styles.emptyState}>{t('noCellsYet')}</div> : null}
    </div>
  )
}
