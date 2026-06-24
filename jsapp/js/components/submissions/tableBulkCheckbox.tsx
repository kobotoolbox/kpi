import './tableBulkCheckbox.scss'
import React from 'react'
import Menu from '#/components/common/Menu'
import Checkbox from '#/components/common/checkbox'
import Icon from '#/components/common/icon'

interface TableBulkCheckboxProps {
  visibleRowsCount: number
  selectedRowsCount: number
  totalRowsCount: number
  onSelectAllPages: () => void
  onSelectCurrentPage: () => void
  onClearSelection: () => void
}

export default function TableBulkCheckbox(props: TableBulkCheckboxProps) {
  function onSelectAllPages() {
    props.onSelectAllPages()
  }

  function onSelectCurrentPage() {
    props.onSelectCurrentPage()
  }

  function onToggleCurrentPage() {
    if (props.selectedRowsCount === props.visibleRowsCount) {
      onClearSelection()
    } else {
      onSelectCurrentPage()
    }
  }

  function onClearSelection() {
    props.onClearSelection()
  }

  return (
    <div className='table-bulk-checkbox'>
      <Checkbox checked={props.selectedRowsCount === props.visibleRowsCount} onChange={onToggleCurrentPage} />

      <Menu>
        <Menu.Target>
          <button type='button' className='table-bulk-checkbox-trigger'>
            <Icon name='caret-down' size='s' />
          </button>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item onClick={onSelectAllPages}>
            {t('Select all results (##count##)').replace('##count##', String(props.totalRowsCount))}
          </Menu.Item>

          <Menu.Item onClick={onSelectCurrentPage}>
            {t('Select visible results (##count##)').replace('##count##', String(props.visibleRowsCount))}
          </Menu.Item>

          <Menu.Item onClick={onClearSelection}>{t('None')}</Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </div>
  )
}
