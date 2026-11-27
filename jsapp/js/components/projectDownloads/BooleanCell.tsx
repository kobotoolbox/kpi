import { Text, VisuallyHidden } from '@mantine/core'
import { IconCheck } from '@tabler/icons-react'
import React from 'react'
import KoboIcon from '#/components/common/KoboIcon'
import { isExportSettingEnabled } from '#/components/projectDownloads/exportsUtils'

interface BooleanCellProps {
  value: boolean | string | undefined
}

export default function BooleanCell({ value }: BooleanCellProps) {
  if (isExportSettingEnabled(value)) {
    return <KoboIcon icon={IconCheck} color='teal' size='sm' aria-label={t('Yes')} />
  }
  return (
    <>
      <Text span aria-hidden>
        –
      </Text>
      <VisuallyHidden>{t('No')}</VisuallyHidden>
    </>
  )
}
