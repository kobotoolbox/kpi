import React from 'react';
import {PROJECT_FIELDS} from 'js/projects/projectViews/constants';
import type {
  OrderDirection,
  ProjectFieldDefinition,
  ProjectFieldName,
} from 'js/projects/projectViews/constants';
import tableStyles from './projectsTable.module.scss';
import rowStyles from './projectsTableRow.module.scss';
import classNames from 'classnames';

interface ProjectsTableHeaderProps {
  highlightedFields: ProjectFieldName[];
  visibleFields: ProjectFieldName[];
  /** Current ordering field. */
  orderFieldName: ProjectFieldName;
  orderDirection: OrderDirection;
  onChangeOrderRequested: (fieldName: ProjectFieldName) => void;
}

export default function ProjectsTableHeader(props: ProjectsTableHeaderProps) {
  const renderColumn = (field: ProjectFieldDefinition) => {
    // Hide not visible fields.
    if (!props.visibleFields.includes(field.name)) {
      return null;
    }

    // empty icon to take up space in column
    let icon = (<i className='k-icon'/>);
    if (props.orderFieldName === field.name) {
      if (props.orderDirection === 'ascending') {
        icon = (<i className='k-icon k-icon-angle-up'/>);
      }
      if (props.orderDirection === 'descending') {
        icon = (<i className='k-icon k-icon-angle-down'/>);
      }
    }

    return (
      <div
        className={classNames({
          [rowStyles.cell]: true,
          [rowStyles[`cell-${field.name}`]]: true,
          [rowStyles['cell-highlighted']]: props.highlightedFields.includes(field.name),
        })}
        key={field.name}
        onClick={() => props.onChangeOrderRequested(field.name)}
      >
        <label className={rowStyles['header-label']}>{field.label}</label>
        {icon}
      </div>
    );
  };

  return (
    <header className={tableStyles.header}>
      <div className={classNames(rowStyles.row, rowStyles['row-header'])}>
        {Object.values(PROJECT_FIELDS).map(renderColumn)}
      </div>
    </header>
  );
}

