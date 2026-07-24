import { Group, Stack, Text } from '@mantine/core'
import React from 'react'
import Icon from '#/components/common/icon'
import type { IconName } from '#/k-icons'
import { getSubmissionPositionLabel } from './tableMediaPreview.utils'

interface TableMediaPreviewModalTitleProps {
  submissionIndex: number
  submissionTotal: number
  titleText: string
  titleTextTooltip?: string
  questionIcon?: IconName
  actions?: React.ReactNode
  showSubmissionContext?: boolean
}

export default function TableMediaPreviewModalTitle(props: TableMediaPreviewModalTitleProps) {
  return (
    <Group justify='space-between' wrap='nowrap'>
      <Stack gap={2}>
        {props.showSubmissionContext && (
          <Text>{getSubmissionPositionLabel(props.submissionIndex, props.submissionTotal)}</Text>
        )}

        <Group gap='sm'>
          {props.questionIcon && <Icon name={props.questionIcon} />}
          <Text truncate='end' title={props.titleTextTooltip ?? props.titleText}>
            {props.titleText}
          </Text>
        </Group>
      </Stack>

      {props.actions && <Group gap='sm'>{props.actions}</Group>}
    </Group>
  )
}
