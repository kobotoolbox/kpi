import { Group, ScrollArea, Text } from '@mantine/core'
import { IconArrowsDiagonal, IconPencilStar } from '@tabler/icons-react'
import React, { useState } from 'react'
import ActionIcon from '#/components/common/ActionIcon'
import ProcessingPromptModal from '#/components/common/ProcessingPromptModal'
import Icon from '#/components/common/icon'
import { goToProcessing } from '#/components/processing/routes.utils'
import type { SubmissionResponse } from '#/dataInterface'
import { FeatureFlag, useFeatureFlag } from '#/featureFlags'
import { getSubmissionRootUuid } from '#/utils'
import styles from './TextCell.module.scss'

interface TextCellProps {
  assetUid: string
  /** Omit when there is no question to open in Processing for this cell (e.g. it's a supplemental detail itself), or it's missing on some legacy asset versions. */
  xpath?: string
  submissionData: SubmissionResponse
  /** Text response for this question, `null`/empty renders a blank cell with no actions. */
  text: string | null | undefined
  /** The question label, as displayed in the column header. */
  questionLabel: string
}

/**
 * Table cell for `text` question type answers. Mirrors `AudioCell`: a
 * truncated preview of the response plus "View details" (opens a dialog with
 * the full, scrollable text) and "Open" (jumps straight into Processing).
 */
export default function TextCell(props: TextCellProps) {
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false)
  const isNlpTextActionsEnabled = useFeatureFlag(FeatureFlag.nlpTextActionsEnabled)

  if (!props.text) {
    return (
      <div className={styles.cell}>
        <span className={styles.textContent}>{''}</span>
      </div>
    )
  }

  // Some legacy asset versions lack `$xpath` on their survey rows, in which case
  // there is no reliable question path to open Processing with.
  const canOpenProcessing = isNlpTextActionsEnabled && props.xpath !== undefined
  const xpath = props.xpath

  const submissionEditId = getSubmissionRootUuid(props.submissionData)

  const openProcessing = () => {
    if (xpath === undefined) {
      return
    }
    goToProcessing(props.assetUid, xpath, submissionEditId)
  }

  return (
    <div className={styles.cell} dir='auto'>
      <span className={styles.textContent}>{props.text}</span>

      <Group ml='auto' gap={0} wrap='nowrap'>
        <ActionIcon
          variant='transparent'
          tooltip={t('View details')}
          icon={IconArrowsDiagonal}
          size='sm'
          onClick={() => setIsDetailsDialogOpen(true)}
        />
        {canOpenProcessing && (
          <ActionIcon
            variant='transparent'
            tooltip={t('Open')}
            icon={IconPencilStar}
            size='sm'
            onClick={openProcessing}
          />
        )}
      </Group>

      <ProcessingPromptModal
        opened={isDetailsDialogOpen}
        onClose={() => setIsDetailsDialogOpen(false)}
        title={
          <Group gap='xs'>
            <Icon name='qt-text' size='s' />
            <Text fw={600}>{props.questionLabel}</Text>
          </Group>
        }
        onAction={
          canOpenProcessing
            ? () => {
                setIsDetailsDialogOpen(false)
                openProcessing()
              }
            : undefined
        }
      >
        <ScrollArea.Autosize mah={300} type='auto' offsetScrollbars>
          <Text dir='auto' style={{ whiteSpace: 'pre-wrap' }}>
            {props.text}
          </Text>
        </ScrollArea.Autosize>
      </ProcessingPromptModal>
    </div>
  )
}
