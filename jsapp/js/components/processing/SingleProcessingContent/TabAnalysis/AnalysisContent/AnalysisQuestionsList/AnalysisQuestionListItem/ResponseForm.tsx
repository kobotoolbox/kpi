import React, { useState } from 'react'

import { Group, Modal, Stack, Text } from '@mantine/core'
import { Box, ThemeIcon } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import ActionIcon from '#/components/common/ActionIcon'
import ButtonNew from '#/components/common/ButtonNew'
import Icon from '#/components/common/icon'

import type { ResponseManualQualActionParams } from '#/api/models/responseManualQualActionParams'
import { FeatureFlag, useFeatureFlag } from '#/featureFlags'
import { getQuestionTypeDefinition } from '../../../common/utils'

interface Props {
  children?: React.ReactNode
  qaQuestion: ResponseManualQualActionParams
  /** Adds a clear button with the given logic */
  onClear?: () => unknown
  disabled: boolean
  onEdit: (qaQuestion: ResponseManualQualActionParams) => unknown
  onDelete: (qaQuestion: ResponseManualQualActionParams) => Promise<unknown>
  /**
   * Adds a Generate with AI button. API handling is being served by parent(s), as this component doesn't have all
   * the required data and it's easier to push this one function up than all the small pieces down.
   */
  onGenerateWithAI?: () => Promise<unknown>
}

/**
 * Displays question type icon, name, and an edit and delete buttons (if user
 * has sufficient permissions). Is being used in multiple other components.
 */
export default function ResponseForm({
  qaQuestion,
  children,
  onClear,
  disabled,
  onEdit,
  onDelete,
  onGenerateWithAI,
}: Props) {
  const [opened, { open, close }] = useDisclosure(false)
  const [isGenerating, setIsGenerating] = useState(false)

  const ffAutoQAEnabled = useFeatureFlag(FeatureFlag.autoQAEnabled)

  // Get the question definition (with safety check)
  const qaQuestionDef = getQuestionTypeDefinition(qaQuestion.type)
  if (!qaQuestionDef) {
    return null
  }

  const handleEdit = () => {
    onEdit(qaQuestion)
  }

  const handleDelete = async () => {
    await onDelete(qaQuestion)
    close()
  }

  const handleGenerateWithAI = async () => {
    if (!onGenerateWithAI) return
    setIsGenerating(true)
    try {
      await onGenerateWithAI()
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Stack gap='10px'>
      <Group align={'flex-start'} gap={'xs'}>
        {!disabled && (
          <Modal opened={opened} onClose={close} title={t('Delete this question?')} size={'md'}>
            <Stack gap='24px'>
              <Text>{t('Are you sure you want to delete this question? This action cannot be undone.')}</Text>
              <Group align='left'>
                <ButtonNew size='md' onClick={close} variant='light'>
                  {t('Cancel')}
                </ButtonNew>

                <ButtonNew size='md' onClick={handleDelete} variant='danger'>
                  {t('Delete')}
                </ButtonNew>
              </Group>
            </Stack>
          </Modal>
        )}

        <ThemeIcon ta={'center'} variant='light-teal'>
          <Icon name={qaQuestionDef.icon} size='xl' />
        </ThemeIcon>

        {/*TODO: font weight is not standardized DEV-1238*/}
        <Text
          style={{ wordBreak: 'break-all' }}
          span
          c={'gray.2'}
          fw={600}
          fz={'lg'}
          flex={1}
          mih={32}
          display={'flex'}
          ta={'left'}
        >
          {qaQuestion.labels._default}
        </Text>
        {!disabled && (
          <>
            {onClear && (
              <ButtonNew variant='light' size='sm' onClick={onClear}>
                {t('Clear')}
              </ButtonNew>
            )}

            <ActionIcon
              variant='light'
              size='sm'
              iconName='edit'
              onClick={handleEdit}
              // We only allow editing one question at a time, so adding new is not
              // possible until user stops editing
              disabled={disabled}
            />

            <ActionIcon variant='danger-secondary' size='sm' iconName='trash' onClick={open} disabled={disabled} />
          </>
        )}
      </Group>

      {/* Hard coded left padding to account for the 32px icon size + 8px gap */}
      {children && <Box pl={'40px'}>{children}</Box>}
      {!disabled && ffAutoQAEnabled && onGenerateWithAI && (
        <Group pl={'40px'}>
          <ButtonNew
            variant='transparent'
            h='fit-content'
            size='md'
            p={0}
            disabled={disabled}
            c='var(--mantine-color-blue-5)'
            leftIcon='sparkles'
            onClick={handleGenerateWithAI}
            loading={isGenerating}
            loaderProps={{ type: 'dots' }}
          >
            {t('Generate with AI')}
          </ButtonNew>
        </Group>
      )}
    </Stack>
  )
}
