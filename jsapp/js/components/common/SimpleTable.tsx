import { type MantineStyleProps, Table, type TableData } from '@mantine/core'
import styles from './SimpleTable.module.scss'

interface SimpleTableProps extends MantineStyleProps {
  head: TableData['head']
  body: TableData['body']
  /**
   * Passing minimum width enables contextual horizontal scrollbar (i.e. without
   * it the table will never display scrollbar - regardless of how small
   * the screen is).
   */
  minWidth?: number
  /**
   * Relative width of each column (in order), e.g. `[1, 2, 1]` makes the middle
   * column twice as wide as the others. Passing this switches the table to
   * fixed layout, so tables sharing the same weights line up with each other.
   */
  columnWeights?: number[]
}

/**
 * A wrapper component for `Table` from `@mantine/core`. It requires column
 * headings, column data, and has optional minimum width. You can pass all
 * standard Mantine style props down to the inner `Table`.
 */
export default function SimpleTable({ head, body, minWidth, columnWeights, ...styleProps }: SimpleTableProps) {
  const totalWeight = columnWeights?.reduce((sum, weight) => sum + weight, 0) ?? 0

  const table = (
    <Table
      {...styleProps}
      classNames={{
        table: styles.SimpleTableRoot,
        thead: styles.SimpleTableThead,
        th: styles.SimpleTableTh,
        td: styles.SimpleTableTd,
      }}
      horizontalSpacing='sm'
      verticalSpacing='sm'
      layout={columnWeights ? 'fixed' : undefined}
    >
      {columnWeights && (
        <colgroup>
          {columnWeights.map((weight, index) => (
            <col key={index} style={{ width: `${(weight / totalWeight) * 100}%` }} />
          ))}
        </colgroup>
      )}
      <Table.DataRenderer data={{ head: head, body: body }} />
    </Table>
  )

  if (minWidth) {
    return (
      <Table.ScrollContainer minWidth={minWidth} type='native'>
        {table}
      </Table.ScrollContainer>
    )
  }

  return table
}
