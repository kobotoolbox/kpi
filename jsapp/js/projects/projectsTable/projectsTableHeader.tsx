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
import Icon from 'js/components/common/icon';

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

    return (
      <div
        className={classNames({
          [rowStyles.cell]: true,
          [rowStyles.cellHighlighted]: props.highlightedFields.includes(
            field.name
          ),
        })}
        data-field={field.name}
        key={field.name}
        onClick={() => props.onChangeOrderRequested(field.name)}
      >
        <label className={rowStyles.headerLabel}>{field.label}</label>

        {props.order.fieldName === field.name &&
          props.order.direction === 'ascending' && (
            <Icon name='sort-up' size='s' />
          )}
        {props.order.fieldName === field.name &&
          props.order.direction === 'descending' && (
            <Icon name='sort-down' size='s' />
          )}
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
