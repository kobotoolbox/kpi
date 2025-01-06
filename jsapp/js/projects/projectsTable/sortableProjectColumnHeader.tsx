// Libraries
import React, {useState} from 'react';
import cx from 'classnames';

// Partial components
import Icon from 'js/components/common/icon';
import Button from 'jsapp/js/components/common/button';
import KoboDropdown from 'jsapp/js/components/common/koboDropdown';

// Constants and types
import type {ProjectsTableOrder} from './projectsTable';
import {type ProjectFieldDefinition, type ProjectFieldName} from '../projectViews/constants';

// Styles
import styles from './projectsTableHeader.module.scss';
import rowStyles from './projectsTableRow.module.scss';

interface SortableProjectColumnHeaderProps {
  styling: boolean;
  field: ProjectFieldDefinition;
  highlightedFields?: ProjectFieldName[];
  orderableFields: ProjectFieldName[];
  order: ProjectsTableOrder;
  onChangeOrderRequested: (order: ProjectsTableOrder) => void;
  onHideFieldRequested?: (fieldName: ProjectFieldName) => void;
}

export default function SortableProjectColumnHeader(props: SortableProjectColumnHeaderProps) {
  // We track the menu visibility for the trigger icon.
  const [visibleMenuNames, setVisibleMenuNames] = useState<string[]>([]);
  const isMenuVisible = visibleMenuNames.includes(props.field.name);

  return (
      <div
        title={props.field.label}
        className={cx({
          [styles.columnRoot]: props.styling,
          [styles.isMenuVisible]: isMenuVisible,
          [rowStyles.cell]: props.styling,
          [rowStyles.cellHighlighted]: props.highlightedFields?.includes(
            props.field.name
          ),
        })}
        // This attribute is being used for styling and for ColumnResizer
        data-field={props.field.name}
        key={props.field.name}
      >
          <KoboDropdown
            name={props.field.name}
            placement={'down-left'}
            hideOnMenuClick
            onMenuVisibilityChange={(isVisible: boolean) => {
              let newVisibleMenuNames = Array.from(visibleMenuNames);
              if (isVisible) {
                newVisibleMenuNames.push(props.field.name);
              } else {
                newVisibleMenuNames = newVisibleMenuNames.filter((item) => item !== props.field.name);
              }
              setVisibleMenuNames(newVisibleMenuNames);
            }}
            triggerContent={
              <div className={styles.trigger}>
                <Icon size='xxs' name={visibleMenuNames.includes(props.field.name) ? 'caret-up' : 'caret-down'} />
                <label className={rowStyles.headerLabel}>{props.field.label}</label>
                {props.order.fieldName === props.field.name && (
                  <Icon
                    name={
                      props.order.direction === 'descending' ? 'sort-descending' : 'sort-ascending'
                    }
                    size='s'
                  />
                )}
              </div>
            }
            menuContent={
              <div className={styles.dropdownContent}>
                {props.orderableFields.includes(props.field.name) && (
                  <Button
                    type='text'
                    size='m'
                    label={t('Default sort')}
                    startIcon='sort-default'
                    onClick={() => {
                      props.onChangeOrderRequested({});
                    }}
                  />
                )}
                {props.orderableFields.includes(props.field.name) && (
                  <Button
                    type='text'
                    size='m'
                    label={t('Sort A→Z')}
                    startIcon='sort-ascending'
                    onClick={() => {
                      props.onChangeOrderRequested({
                        fieldName: props.field.name,
                        direction: 'ascending',
                      });
                    }}
                  />
                )}
                {props.orderableFields.includes(props.field.name) && (
                  <Button
                    type='text'
                    size='m'
                    label={t('Sort Z→A')}
                    startIcon='sort-descending'
                    onClick={() => {
                      props.onChangeOrderRequested({
                        fieldName: props.field.name,
                        direction: 'descending',
                      });
                    }}
                  />
                )}
                {/* The `name` field is always visible, no need for the button */}
                {props.onHideFieldRequested && props.field.name !== 'name' && (
                  <Button
                    type='text'
                    size='m'
                    label={t('Hide field')}
                    startIcon='hide'
                    onClick={() => {
                      if (props.onHideFieldRequested) {
                        props.onHideFieldRequested(props.field.name);
                      }
                    }}
                  />
                )}
              </div>
            }
          />
        <div className={styles.resizer} data-resize-fieldname={props.field.name} />
      </div>
    );
}
