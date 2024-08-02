import React from 'react';
import KoboDropdown from 'js/components/common/koboDropdown';
import ColumnsHideForm from 'js/components/submissions/columnsHideForm';
import type {ColumnsHideFormProps} from 'js/components/submissions/columnsHideForm';
import './columnsHideDropdown.scss';
import Button from 'js/components/common/button'

/**
 * A wrapper around KoboDropdown to be used atop table to bulk hide columns.
 */
export default function ColumnsHideDropdown(props: ColumnsHideFormProps) {
  return (
    <KoboDropdown
      placement='down-left'
      name='columns-hide-dropdown'
      triggerContent={
        <Button
          type='text'
          size='m'
          startIcon='hide'
          label={t('hide fields')}
        />
      }
      menuContent={<ColumnsHideForm {...props} />}
      hideOnMenuClick={false}
    />
  );
}
