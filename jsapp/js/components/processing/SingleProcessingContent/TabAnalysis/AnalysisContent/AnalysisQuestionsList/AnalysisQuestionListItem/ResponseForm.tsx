import React, { useState } from 'react'

import { Box, Group, Modal, Stack, Text, ThemeIcon } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'

import type { ResponseManualQualActionParams } from '#/api/models/responseManualQualActionParams'

import ActionIcon from '#/components/common/ActionIcon'
import ButtonNew from '#/components/common/ButtonNew'
import Icon from '#/components/common/icon'
import type { QualVersionItem } from '#/components/processing/common/types'
import { FeatureFlag, useFeatureFlag } from '#/featureFlags'

import { getQuestionTypeDefinition, hasEmptyValueAnswer } from '../../../common/utils'

interface Props {
  children?: React.ReactNode
  qaQuestion: ResponseManualQualActionParams
  // It is both optional (not all types have answers) and can be `undefined` as value
  answer?: QualVersionItem
  disabled: boolean
  // This is optional because some types are not clearable
  onClear?: () => Promise<void>
  onEdit: (qaQuestion: ResponseManualQualActionParams) => unknown
  onDelete: (qaQuestion: ResponseManualQualActionParams) => Promise<unknown>
  /**
   * Adds a Generate with AI button. API handling is being served by parent(s), as this component doesn't have all
   * the required data and it's easier to push this one function up than all the small pieces down.
   */
  onGenerateWithAI?: () => Promise<unknown>
  isAnswerAIGenerated?: boolean
  hasTranscript: boolean
}

/**
 * Displays question type icon, name, and an edit and delete buttons (if user
 * has sufficient permissions). Is being used in multiple other components.
 */
export default function ResponseForm({
  children,
  qaQuestion,
  answer,
  disabled,
  onClear,
  onEdit,
  onDelete,
  onGenerateWithAI,
  isAnswerAIGenerated,
  hasTranscript,
}: Props) {
  const [opened, { open, close }] = useDisclosure(false)
  const [isGenerating, setIsGenerating] = useState(false)

  const ffAutoQAEnabled = useFeatureFlag(FeatureFlag.autoQAEnabled)

  // Get the question definition (with safety check)
  const qaQuestionDef = getQuestionTypeDefinition(qaQuestion.type)
  if (!qaQuestionDef) {
    return null
  }

  /**
   * This means that an answer exist. We need it this way, because sometimes the answer is just an empty value. For
   * example the "Generate with AI" might return empty response for `qual_select_one`, because none of the choices are
   * to be selected.
   */
  const hasAnswer = answer !== undefined
  const hasEmptyValueAnswerVal = hasEmptyValueAnswer(qaQuestion.type, answer)

  /**
   * "Generate with AI" button will be displayed if there is no answer, or if answer is not AI generated empty value.
   *
   * We also hide it if there is no transcript or if `onGenerateWithAI` callback is not provided.
   */
  const shouldDisplayGenerateWithAIButton = () => {
    return (
      hasTranscript &&
      onGenerateWithAI !== undefined &&
      (!hasAnswer || (hasEmptyValueAnswerVal && !isAnswerAIGenerated))
    )
  }

  /**
   * "Clear" button will be displayed if there is non-empty answer, or if answer is AI generated
   */
  const shouldDisplayClearButton = () => {
    return onClear !== undefined && ((hasAnswer && !hasEmptyValueAnswerVal) || (hasAnswer && isAnswerAIGenerated))
  }

  const shouldDisplayAIGeneratedBadge = () => {
    return isAnswerAIGenerated
  }

  const shouldDisplayAnyButtonOrBadge = () => {
    return shouldDisplayGenerateWithAIButton() || shouldDisplayClearButton() || shouldDisplayAIGeneratedBadge()
  }

  const handleClear = async () => {
    if (!onClear) return
    await onClear()
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
      {children && <Box pl='40px'>{children}</Box>}

      {shouldDisplayAnyButtonOrBadge() && ffAutoQAEnabled && (
        <Group pl='40px' w='100%' style={{ justifyContent: 'space-between' }}>
          {shouldDisplayGenerateWithAIButton() && (
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
          )}

          {shouldDisplayClearButton() && (
            <ButtonNew
              variant='transparent'
              h='fit-content'
              size='md'
              p={0}
              disabled={disabled}
              c='var(--mantine-color-red-5)'
              leftIcon='close'
              onClick={handleClear}
              loaderProps={{ type: 'dots' }}
            >
              {t('Clear')}
            </ButtonNew>
          )}

          {shouldDisplayAIGeneratedBadge() && (
            <Group pl='40px' c='var(--mantine-color-blue-5)' gap='xs'>
              <Icon name='sparkles' size='m' />
              <Text>{t('AI generated')}</Text>
            </Group>
          )}
        </Group>
      )}
    </Stack>
  )
}
