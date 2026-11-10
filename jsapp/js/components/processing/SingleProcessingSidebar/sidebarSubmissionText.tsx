import { Group, ScrollArea, Stack, Text } from '@mantine/core'
import React from 'react'
import type { DataResponse } from '#/api/models/dataResponse'
import Icon from '#/components/common/icon'
import { findAttachmentByQuestionXpath } from '#/components/submissions/submissionMediaUtils'

interface SidebarSubmissionTextProps {
  xpath: string
  submission?: DataResponse
}

/** Analogous to `SidebarSubmissionMedia`, but for `text` question responses. */
export default function SidebarSubmissionText({ xpath, submission }: SidebarSubmissionTextProps) {
  if (!submission) {
    return null
  }

  // A text answer has no file to name its type, so it is identified the other way round: a
  // path with an attachment holds media, one without holds a typed-in response.
  if (findAttachmentByQuestionXpath(submission, xpath)) {
    return null
  }

  const value = submission[xpath]
  if (typeof value !== 'string' || value === '') {
    return null
  }

  return (
    <Stack bg='white' p='lg' mah={200} gap='sm' style={{ borderRadius: 'var(--mantine-radius-default)' }}>
      <Group gap='xs' style={{ flexShrink: 0 }}>
        <Icon name='qt-text' size='m' />
        <Text fw={600} c='blue.3' component='span'>
          {t('Original response')}
        </Text>
      </Group>

      {/* Keyed by submission so switching records remounts the scroll area, resetting its scroll position. */}
      <ScrollArea key={submission._uuid} style={{ flex: 1 }} type='auto' offsetScrollbars>
        <Text dir='auto' style={{ whiteSpace: 'pre-wrap' }}>
          {value}
        </Text>
      </ScrollArea>
    </Stack>
  )
}
