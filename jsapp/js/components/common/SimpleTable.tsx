import {Table, type TableData} from '@mantine/core';

interface SimpleTableProps {
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
 * headings, column data, and has optional minimum width.
 */
export default function SimpleTable(props: SimpleTableProps) {
  const table = (
    <Table
      data={{head: props.head, body: props.body}}
      horizontalSpacing='sm'
      verticalSpacing='sm'
    />
  );

  if (props.minWidth) {
    return (
      <Table.ScrollContainer minWidth={props.minWidth} type='native'>
        {table}
      </Table.ScrollContainer>
    );
  }

  return table;
}
