import React from 'react';
import bem from 'js/bem';
import PopoverMenu from 'js/popoverMenu';
import Checkbox from 'js/components/common/checkbox';
import Icon from 'js/components/common/icon';
import './tableBulkCheckbox.scss';

interface TableBulkCheckboxProps {
  visibleRowsCount: number;
  selectedRowsCount: number;
  totalRowsCount: number;
  onSelectAllPages: () => void;
  onSelectCurrentPage: () => void;
  onClearSelection: () => void;
}

export function TableBulkCheckbox(props: TableBulkCheckboxProps) {
  function onSelectAllPages() {
    props.onSelectAllPages();
  }

  function onSelectCurrentPage() {
    props.onSelectCurrentPage();
  }

  function onToggleCurrentPage() {
    if (props.selectedRowsCount === props.visibleRowsCount) {
      onClearSelection();
    } else {
      onSelectCurrentPage();
    }
  }

  function onClearSelection() {
    props.onClearSelection();
  }

  return (
    <div className='table-bulk-checkbox'>
      <Checkbox
        checked={props.selectedRowsCount === props.visibleRowsCount}
        onChange={onToggleCurrentPage}
      />

      <PopoverMenu
        type='table-bulk-checkbox'
        triggerLabel={
          <Icon name='caret-down' size='s' />
        }
        additionalModifiers={['right']}
      >
        <bem.PopoverMenu__link onClick={onSelectAllPages}>
          {t('Select all results (##count##)').replace('##count##', String(props.totalRowsCount))}
        </bem.PopoverMenu__link>

        <bem.PopoverMenu__link onClick={onSelectCurrentPage}>
          {t('Select visible results (##count##)').replace('##count##', String(props.visibleRowsCount))}
        </bem.PopoverMenu__link>

        <bem.PopoverMenu__link onClick={onClearSelection}>
          {t('None')}
        </bem.PopoverMenu__link>
      </PopoverMenu>
    </div>
  );
}

export default TableBulkCheckbox;
