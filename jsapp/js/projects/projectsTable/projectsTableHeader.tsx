import React from 'react';
import {PROJECT_FIELDS} from 'js/projects/projectViews/constants';
import type {
  ProjectFieldDefinition,
  ProjectFieldName,
} from 'js/projects/projectViews/constants';
import type {ProjectsTableOrder} from './projectsTable';
import tableStyles from './projectsTable.module.scss';
import rowStyles from './projectsTableRow.module.scss';
import classNames from 'classnames';

interface ProjectsTableHeaderProps {
  highlightedFields: ProjectFieldName[];
  visibleFields: ProjectFieldName[];
  order: ProjectsTableOrder;
  onChangeOrderRequested: (fieldName: ProjectFieldName) => void;
}

export default function ProjectsTableHeader(props: ProjectsTableHeaderProps) {
  const renderColumn = (field: ProjectFieldDefinition) => {
    // Hide not visible fields.
    if (!props.visibleFields.includes(field.name)) {
      return null;
    }

    // empty icon to take up space in column
    let icon = <i className='k-icon' />;
    if (props.order.fieldName === field.name) {
      if (props.order.direction === 'ascending') {
        icon = <i className='k-icon k-icon-angle-up' />;
      }
      if (props.order.direction === 'descending') {
        icon = <i className='k-icon k-icon-angle-down' />;
      }
    }

    return (
      <div
        className={classNames({
          [rowStyles.cell]: true,
          [rowStyles.cellHighlighted]: props.highlightedFields.includes(
            field.name
          ),
        })}
        data-fieldName={field.name}
        key={field.name}
        onClick={() => props.onChangeOrderRequested(field.name)}
      >
        <label className={rowStyles.headerLabel}>{field.label}</label>
        {icon}
      </div>
    );
  };

  return (
    <header className={tableStyles.header}>
      <div className={classNames(rowStyles.row, rowStyles.rowTypeHeader)}>
        {Object.values(PROJECT_FIELDS).map(renderColumn)}
      </div>
    </header>
  );
}
