import { useState } from 'react'

import cx from 'classnames'
import Menu from '#/components/common/Menu'
import Icon from '#/components/common/icon'
import type { OrderDirection } from '../projectViews/constants'
import styles from './projectsTableHeader.module.scss'
import rowStyles from './projectsTableRow.module.scss'

/**
 * The bits of a column definition this component needs. `ProjectFieldDefinition` satisfies it, and so does any other
 * `{name, label}` pair.
 */
export interface SortableColumnField<FieldName extends string> {
  name: FieldName
  label: string
}

export interface SortableColumnOrder<FieldName extends string> {
  fieldName?: FieldName
  direction?: OrderDirection
}

/**
 * Note: field names are generic, so that tables other than the projects one (e.g. the members table) can use this
 * component with their own column names.
 */
interface SortableProjectColumnHeaderProps<FieldName extends string> {
  styling: boolean
  field: SortableColumnField<FieldName>
  highlightedFields?: FieldName[]
  orderableFields: FieldName[]
  order: SortableColumnOrder<FieldName>
  onChangeOrderRequested: (order: SortableColumnOrder<FieldName>) => void
  onHideFieldRequested?: (fieldName: FieldName) => void
  /**
   * For compatibility with react-table set `fixedWidth` because we don't need a resizer header, if you are not using
   * react-table leave this false. See DEV-1255.
   */
  fixedWidth?: boolean
}

export default function SortableProjectColumnHeader<FieldName extends string>(
  props: SortableProjectColumnHeaderProps<FieldName>,
) {
  // We track the menu visibility for the trigger icon.
  const [isMenuVisible, setIsMenuVisible] = useState(false)

  const isOrderable = props.orderableFields.includes(props.field.name)
  // The `name` field is always visible, no need for the button.
  const isHideable = props.onHideFieldRequested !== undefined && props.field.name !== 'name'

  return (
    <div
      title={props.field.label}
      className={cx({
        [styles.columnRoot]: props.styling,
        [styles.isMenuVisible]: isMenuVisible,
        [rowStyles.cell]: props.styling,
        [rowStyles.cellHighlighted]: props.highlightedFields?.includes(props.field.name),
      })}
      // This attribute is being used for styling and for ColumnResizer
      data-field={props.field.name}
    >
      <Menu
        closeOnItemClick
        position='bottom-start'
        offset={0}
        onOpen={() => setIsMenuVisible(true)}
        onClose={() => setIsMenuVisible(false)}
      >
        <Menu.Target>
          <button type='button' className={styles.trigger}>
            <Icon size='xxs' name={isMenuVisible ? 'caret-up' : 'caret-down'} />

            <span className={cx(rowStyles.headerLabel, styles.triggerLabel)}>{props.field.label}</span>

            {props.order.fieldName === props.field.name && (
              <Icon name={props.order.direction === 'descending' ? 'sort-descending' : 'sort-ascending'} size='s' />
            )}
          </button>
        </Menu.Target>

        <Menu.Dropdown>
          {isOrderable && (
            <>
              <Menu.Item
                leftSection={<Icon name='sort-default' size='m' />}
                onClick={() => {
                  props.onChangeOrderRequested({})
                }}
              >
                {t('Default sort')}
              </Menu.Item>

              <Menu.Item
                leftSection={<Icon name='sort-ascending' size='m' />}
                onClick={() => {
                  props.onChangeOrderRequested({
                    fieldName: props.field.name,
                    direction: 'ascending',
                  })
                }}
              >
                {t('Sort A→Z')}
              </Menu.Item>

              <Menu.Item
                leftSection={<Icon name='sort-descending' size='m' />}
                onClick={() => {
                  props.onChangeOrderRequested({
                    fieldName: props.field.name,
                    direction: 'descending',
                  })
                }}
              >
                {t('Sort Z→A')}
              </Menu.Item>
            </>
          )}

          {isHideable && (
            <Menu.Item
              leftSection={<Icon name='hide' size='m' />}
              onClick={() => {
                props.onHideFieldRequested?.(props.field.name)
              }}
            >
              {t('Hide field')}
            </Menu.Item>
          )}
        </Menu.Dropdown>
      </Menu>

      {!props.fixedWidth && <div className={styles.resizer} data-resize-fieldname={props.field.name} />}
    </div>
  )
}
