import { Group, Stack, Text } from '@mantine/core'
import React from 'react'
import Icon from '#/components/common/icon'
import type { IconName } from '#/k-icons'
import classes from './TableMediaPreview.module.scss'
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
    <Group justify='space-between' wrap='nowrap' className={classes.header}>
      <Stack gap={2} className={classes.titleStack}>
        {props.showSubmissionContext && (
          <Text size='sm'>{getSubmissionPositionLabel(props.submissionIndex, props.submissionTotal)}</Text>
        )}

        <div className={classes.title}>
          {props.questionIcon && <Icon name={props.questionIcon} />}
          <Text className={classes.titleLabel} truncate='end' title={props.titleTextTooltip ?? props.titleText}>
            {props.titleText}
          </Text>
        </div>
      </Stack>

      {props.actions && <div className={classes.headerOptions}>{props.actions}</div>}
    </Group>
  )
}
