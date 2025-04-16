import './columnsHideDropdown.scss'

import React from 'react'

import Button from '#/components/common/button'
import KoboDropdown from '#/components/common/koboDropdown'
import ColumnsHideForm from '#/components/submissions/columnsHideForm'
import type { ColumnsHideFormProps } from '#/components/submissions/columnsHideForm'

/**
 * A wrapper around KoboDropdown to be used atop table to bulk hide columns.
 */
export default function ColumnsHideDropdown(props: ColumnsHideFormProps) {
  return (
    <KoboDropdown
      placement='down-left'
      name='columns-hide-dropdown'
      triggerContent={<Button type='text' size='m' startIcon='hide' label={t('hide fields')} />}
      menuContent={<ColumnsHideForm {...props} />}
      hideOnMenuClick={false}
    />
  )
}
