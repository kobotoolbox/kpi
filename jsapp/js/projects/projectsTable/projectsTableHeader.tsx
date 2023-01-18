import React, {useState} from 'react';
import {PROJECT_FIELDS} from 'js/projects/projectViews/constants';
import type {
  ProjectFieldDefinition,
  ProjectFieldName,
} from 'js/projects/projectViews/constants';
import type {ProjectsTableOrder} from './projectsTable';
import tableStyles from './projectsTable.module.scss';
import rowStyles from './projectsTableRow.module.scss';
import styles from './projectsTableHeader.module.scss';
import classNames from 'classnames';
import Icon from 'js/components/common/icon';
import KoboDropdown, {
  KoboDropdownPlacements,
} from 'js/components/common/koboDropdown';
import Button from 'jsapp/js/components/common/button';

interface ProjectsTableHeaderProps {
  highlightedFields: ProjectFieldName[];
  visibleFields: ProjectFieldName[];
  orderableFields: ProjectFieldName[];
  order: ProjectsTableOrder;
  onChangeOrderRequested: (order: ProjectsTableOrder) => void;
  onHideFieldRequested: (fieldName: ProjectFieldName) => void;
}

export default function ProjectsTableHeader(props: ProjectsTableHeaderProps) {
  // We track the menu visibility for the trigger icon.
  const [visibleMenuNames, setVisibleMenuNames] = useState<string[]>([]);

  const renderColumn = (field: ProjectFieldDefinition) => {
    // Hide not visible fields.
    if (!props.visibleFields.includes(field.name)) {
      return null;
    }

    const isMenuVisible = visibleMenuNames.includes(field.name);

    return (
      <div
        className={classNames({
          [styles.columnRoot]: true,
          [styles.isMenuVisible]: isMenuVisible,
          [rowStyles.cell]: true,
          [rowStyles.cellHighlighted]: props.highlightedFields.includes(
            field.name
          ),
        })}
        data-field={field.name}
        key={field.name}
      >
        <KoboDropdown
          name={field.name}
          placement={KoboDropdownPlacements['down-center']}
          hideOnMenuClick
          onMenuVisibilityChange={(isVisible: boolean) => {
            let newVisibleMenuNames = Array.from(visibleMenuNames);
            if (isVisible) {
              newVisibleMenuNames.push(field.name);
            } else {
              newVisibleMenuNames = newVisibleMenuNames.filter(
                (item) => item !== field.name
              );
            }
            setVisibleMenuNames(newVisibleMenuNames);
          }}
          triggerContent={
            <div className={styles.trigger}>
              <label className={rowStyles.headerLabel}>{field.label}</label>

              {props.order.fieldName === field.name && (
                <Icon
                  name={
                    props.order.direction === 'descending'
                      ? 'sort-down'
                      : 'sort-up'
                  }
                  size='s'
                />
              )}

              <Icon
                size='xxs'
                name={isMenuVisible ? 'caret-up' : 'caret-down'}
              />
            </div>
          }
          menuContent={
            <div className={styles.dropdownContent}>
              {props.orderableFields.includes(field.name) && (
                <Button
                  type='bare'
                  color='storm'
                  size='m'
                  label={t('Sort A→Z')}
                  startIcon='sort-down'
                  onClick={() => {
                    props.onChangeOrderRequested({
                      fieldName: field.name,
                      direction: 'descending',
                    });
                  }}
                />
              )}
              {props.orderableFields.includes(field.name) && (
                <Button
                  type='bare'
                  color='storm'
                  size='m'
                  label={t('Sort Z→A')}
                  startIcon='sort-up'
                  onClick={() => {
                    props.onChangeOrderRequested({
                      fieldName: field.name,
                      direction: 'ascending',
                    });
                  }}
                />
              )}
              {/* The `name` field is always visible, no need for the button */}
              {field.name !== 'name' && (
                <Button
                  type='bare'
                  color='storm'
                  size='m'
                  label={t('Hide field')}
                  startIcon='hide'
                  onClick={() => {
                    props.onHideFieldRequested(field.name);
                  }}
                />
              )}
            </div>
          }
        />
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
