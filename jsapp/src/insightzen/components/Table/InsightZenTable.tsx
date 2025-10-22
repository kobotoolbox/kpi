import React from 'react'

import styles from '../../styles/Table.module.scss'

export interface InsightZenTableColumn<T> {
  key: string
  label: string
  className?: string
  render?: (row: T) => React.ReactNode
}

interface InsightZenTableProps<T> {
  columns: InsightZenTableColumn<T>[]
  data: T[]
  empty?: React.ReactNode
}

export function InsightZenTable<T>({ columns, data, empty }: InsightZenTableProps<T>) {
  if (!data.length && empty) {
    return <div className={styles.tableContainer}>{empty}</div>
  }

  return (
    <div className={styles.tableContainer}>
      <table className={styles.table}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={column.className} scope='col'>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {columns.map((column) => {
                const value: React.ReactNode = column.render
                  ? column.render(row)
                  : String((row as Record<string, unknown>)[column.key] ?? '')
                return (
                  <td key={column.key} className={column.className}>
                    {value}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
