import { Box, Group, ScrollArea, Text } from '@mantine/core'
import React from 'react'

import type { DataResponse } from '#/api/models/dataResponse'
import { findRowByXpathOrLeafName } from '#/assetUtils'
import Icon from '#/components/common/icon'
import { QUESTION_TYPES } from '#/constants'
import type { AssetResponse } from '#/dataInterface'

interface SidebarSubmissionTextProps {
  xpath: string
  asset: AssetResponse | undefined
  submission?: DataResponse
}

/** Analogous to `SidebarSubmissionMedia`, but for `text` question responses. */
export default function SidebarSubmissionText({ asset, xpath, submission }: SidebarSubmissionTextProps) {
  if (!asset?.content || !submission) {
    return null
  }

  if (findRowByXpathOrLeafName(asset.content, xpath)?.type !== QUESTION_TYPES.text.id) {
    return null
  }

  const value = submission[xpath]
  if (typeof value !== 'string' || value === '') {
    return null
  }

  return (
    <Box
      bg='white'
      p='lg'
      h={200}
      style={{ borderRadius: 'var(--mantine-radius-default)', display: 'flex', flexDirection: 'column' }}
    >
      <Group gap='xs' mb='sm' style={{ flexShrink: 0 }}>
        <Icon name='qt-text' size='m' />
        <Text fw={600} c='blue' component='span'>
          {t('Original response')}
        </Text>
      </Group>

      {/* Keyed by submission so switching records remounts the scroll area, resetting its scroll position. */}
      <ScrollArea key={submission._uuid} style={{ flex: 1 }} type='auto' offsetScrollbars>
        <Text dir='auto' style={{ whiteSpace: 'pre-wrap' }}>
          {value}
        </Text>
      </ScrollArea>
    </Box>
  )
}
