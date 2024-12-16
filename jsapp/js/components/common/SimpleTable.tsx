// Libraries
import {Table, TableData} from '@mantine/core';

// Partial components

// Stores, hooks and utilities
// Constants and types
// Styles

import React from 'react';

interface SimpleTableProps {
  data: TableData;
}

export default function SimpleTable(props: SimpleTableProps) {
  return <Table data={props.data} />;
}
