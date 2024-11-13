// Libraries
import React from 'react';
import cx from 'classnames';

// Partial components
import ColumnResizer from './columnResizer';
import SortableProjectColumnHeader from './sortableProjectColumnHeader';

// Constants and types
import {PROJECT_FIELDS} from 'js/projects/projectViews/constants';
import type {
  ProjectFieldDefinition,
  ProjectFieldName,
} from 'js/projects/projectViews/constants';
import type {ProjectsTableOrder} from './projectsTable';

// Styles
import tableStyles from './projectsTable.module.scss';
import rowStyles from './projectsTableRow.module.scss';

interface ProjectsTableHeaderProps {
  highlightedFields: ProjectFieldName[];
  visibleFields: ProjectFieldName[];
  orderableFields: ProjectFieldName[];
  order: ProjectsTableOrder;
  onChangeOrderRequested: (order: ProjectsTableOrder) => void;
  onHideFieldRequested: (fieldName: ProjectFieldName) => void;
}

export default function ProjectsTableHeader(props: ProjectsTableHeaderProps) {

  const renderColumn = (field: ProjectFieldDefinition) => {
    // Hide not visible fields.
    if (!props.visibleFields.includes(field.name)) {
      return null;
    }

    // Generate a unique key for each rendered column
    const key = `${field.name}_${field.label}`;

    return (
      <SortableProjectColumnHeader
        key={key}
        styling
        field={field}
        highlightedFields={props.highlightedFields}
        orderableFields={props.orderableFields}
        order={props.order}
        onChangeOrderRequested={props.onChangeOrderRequested}
        onHideFieldRequested={props.onHideFieldRequested}
      />
    );
  };

  return (
    <header className={tableStyles.header}>
      <ColumnResizer />
      <div className={cx(rowStyles.row, rowStyles.rowTypeHeader)}>
        {/* First column is always visible and displays a checkbox. */}
        <div className={rowStyles.cell} data-field='checkbox' />

        {Object.values(PROJECT_FIELDS).map(renderColumn)}
      </div>
    </header>
  );
}
