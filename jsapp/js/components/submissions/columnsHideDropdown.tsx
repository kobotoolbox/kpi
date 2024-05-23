import React from 'react';
import KoboDropdown from 'js/components/common/koboDropdown';
import ColumnsHideForm from 'js/components/submissions/columnsHideForm';
import type {ColumnsHideFormProps} from 'js/components/submissions/columnsHideForm';
import './columnsHideDropdown.scss';

/**
 * A wrapper around KoboDropdown to be used atop table to bulk hide columns.
 */
export default function ColumnsHideDropdown(props: ColumnsHideFormProps) {
  return (
    <KoboDropdown
      placement='down-left'
      name='columns-hide-dropdown'
      triggerContent={
        <span className='columns-hide-dropdown-trigger'>
          <i className='k-icon k-icon-hide' />
          {t('hide fields')}
        </span>
      }
      menuContent={<ColumnsHideForm {...props} />}
      hideOnMenuClick={false}
    />
  );
}
