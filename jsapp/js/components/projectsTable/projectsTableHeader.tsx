import React from 'react';
import bem from 'js/bem';
import {PROJECT_FIELDS} from 'js/components/projectsView/projectsViewConstants';
import type {
  OrderDirection,
  ProjectFieldDefinition,
  ProjectFieldName,
} from 'js/components/projectsView/projectsViewConstants';

interface ProjectsTableHeaderProps {
  /** Current ordering field. */
  orderFieldName: ProjectFieldName;
  orderDirection: OrderDirection;
  onChangeOrderRequested: (fieldName: ProjectFieldName) => void;
}

export default function ProjectsTableHeader(props: ProjectsTableHeaderProps) {
  // TODO get this value from calculation
  const scrollbarWidth = 15;

  const renderColumn = (field: ProjectFieldDefinition) => {
    // TODO don't render hidden fields :)

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
      <bem.ProjectsTableRow__column
        m={field.name}
        key={field.name}
        onClick={() => props.onChangeOrderRequested(field.name)}
      >
        <bem.ProjectsTableRow__headerLabel>{field.label}</bem.ProjectsTableRow__headerLabel>
        {icon}
      </bem.ProjectsTableRow__column>
    );
  };

  return (
    <bem.ProjectsTable__header>
      <bem.ProjectsTableRow m='header'>
        {/* First column is always visible and displays a checkbox. */}
        <bem.ProjectsTableRow__column m='checkbox'/>

        {Object.values(PROJECT_FIELDS).map(renderColumn)}

        <div
          className='projects-table__scrollbar-padding'
          style={{width: `${scrollbarWidth}px`}}
        />
      </bem.ProjectsTableRow>
    </bem.ProjectsTable__header>
  );
}

