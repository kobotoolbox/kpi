// Libraries
import type React from 'react';
import {Table, type TableData} from '@mantine/core';

// Partial components

// Stores, hooks and utilities
// Constants and types
// Styles

interface SimpleTableProps {
  head: TableData['head'];
  body: TableData['body'];
  /** Passing min width enables contextual horizontal scrollbar. */
  minWidth?: number;
}

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
