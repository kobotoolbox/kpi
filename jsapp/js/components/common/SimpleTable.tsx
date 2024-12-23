import {Table, type MantineStyleProps, type TableData} from '@mantine/core';
import styles from './SimpleTable.module.scss';

interface SimpleTableProps extends MantineStyleProps {
  head: TableData['head'];
  body: TableData['body'];
  /**
   * Passing minimum width enables contextual horizontal scrollbar (i.e. without
   * it the table will never display scrollbar - regardless of how small
   * the screen is).
   */
  minWidth?: number;
}

/**
 * A wrapper component for `Table` from `@mantine/core`. It requires column
 * headings, column data, and has optional minimum width. You can pass all
 * standard Mantine style props down to the inner `Table`.
 */
export default function SimpleTable(
  {head, body, minWidth, ...styleProps}: SimpleTableProps
) {
  const table = (
    <Table
      {...styleProps}
      classNames={{
        table: styles.SimpleTableRoot,
        thead: styles.SimpleTableThead,
        th: styles.SimpleTableTh,
        td: styles.SimpleTableTd,
      }}
      data={{head: head, body: body}}
      horizontalSpacing='sm'
      verticalSpacing='sm'
    />
  );

  if (minWidth) {
    return (
      <Table.ScrollContainer minWidth={minWidth} type='native'>
        {table}
      </Table.ScrollContainer>
    );
  }

  return table;
}
