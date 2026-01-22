import React, { useContext } from 'react'

import { Group, Modal, Stack, Text } from '@mantine/core'
import { Box, ThemeIcon } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import clonedeep from 'lodash.clonedeep'
import { handleApiFail } from '#/api'
import ActionIcon from '#/components/common/ActionIcon'
import ButtonNew from '#/components/common/ButtonNew'
import Icon from '#/components/common/icon'
import type { AssetResponse, FailResponse } from '#/dataInterface'

import { userCan } from '#/components/permissions/utils'
import AnalysisQuestionsContext from '../../../common/analysisQuestions.context'
import type { AnalysisQuestionInternal } from '../../../common/constants'
import {
  convertQuestionsFromSchemaToInternal,
  findQuestion,
  getQuestionTypeDefinition,
  updateSurveyQuestions,
} from '../../../common/utils'

interface Props {
  asset: AssetResponse
  uuid: string
  /** Adds a clear button with the given logic */
  onClear?: () => unknown
  children?: React.ReactNode
}

/**
 * Displays question type icon, name, and an edit and delete buttons (if user
 * has sufficient permissions). Is being used in multiple other components.
 */
export default function ResponseForm({ asset, uuid, children, onClear }: Props) {
  const [opened, { open, close }] = useDisclosure(false)
  const analysisQuestions = useContext(AnalysisQuestionsContext)
  if (!analysisQuestions) {
    return null
  }

  // Get the question data from state (with safety check)
  const question = findQuestion(uuid, analysisQuestions.state)
  if (!question) {
    return null
  }

  // Get the question definition (with safety check)
  const qaDefinition = getQuestionTypeDefinition(question.type)
  if (!qaDefinition) {
    return null
  }

  /**
   * Means that user clicked "Edit" button and wants to start modyfing
   * the question definition.
   */
  function openQuestionInEditor() {
    analysisQuestions?.dispatch({
      type: 'startEditingQuestion',
      payload: { uuid: uuid },
    })
  }

  async function deleteQuestion() {
    analysisQuestions?.dispatch({
      type: 'deleteQuestion',
      payload: { uuid: uuid },
    })

    close()

    // Step 1: ensure no mutations happen
    const newQuestions: AnalysisQuestionInternal[] = clonedeep(analysisQuestions?.state.questions) || []

    // Step 2: set `deleted` flag on the question
    newQuestions.forEach((item: AnalysisQuestionInternal) => {
      if (item.uuid === uuid) {
        if (typeof item.options !== 'object') {
          item.options = {}
        }
        item.options.deleted = true
      }
    })

    try {
      // Step 3: update asset endpoint with new questions
      const response = await updateSurveyQuestions(asset.uid, newQuestions)

      // Step 4: update reducer's state with new list after the call finishes
      analysisQuestions?.dispatch({
        type: 'deleteQuestionCompleted',
        payload: {
          questions: convertQuestionsFromSchemaToInternal(response),
        },
      })
    } catch (err) {
      handleApiFail(err as FailResponse)
      analysisQuestions?.dispatch({ type: 'udpateQuestionFailed' })
    }
  }

  return (
    <Stack gap={0}>
      <Group align={'flex-start'} gap={'xs'} mb={'xs'} display={'flex'}>
        <Modal opened={opened} onClose={close} title={t('Delete this question?')} size={'md'}>
          <Stack>
            <Text>{t('Are you sure you want to delete this question? This action cannot be undone.')}</Text>
            <Group align='left'>
              <ButtonNew size='md' onClick={close} variant='light'>
                {t('Cancel')}
              </ButtonNew>

              <ButtonNew size='md' onClick={deleteQuestion} variant='danger'>
                {t('Delete')}
              </ButtonNew>
            </Group>
          </Stack>
        </Modal>

        <ThemeIcon ta={'center'} variant='light-teal'>
          <Icon name={qaDefinition.icon} size='xl' />
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
          {question.labels._default}
        </Text>

        <ActionIcon
          variant='light'
          size='sm'
          iconName='edit'
          onClick={openQuestionInEditor}
          // We only allow editing one question at a time, so adding new is not
          // possible until user stops editing
          disabled={
            !userCan('manage_asset', asset) ||
            analysisQuestions.state.questionsBeingEdited.length !== 0 ||
            analysisQuestions.state.isPending
          }
        />

        {onClear && <ActionIcon variant='light' size='sm' iconName='close' onClick={onClear} />}

        <ActionIcon
          variant='danger-secondary'
          size='sm'
          iconName='trash'
          onClick={open}
          disabled={!userCan('manage_asset', asset) || analysisQuestions.state.isPending}
        />
      </Group>

      {/* Hard coded left padding to account for the 32px icon size + 8px gap */}
      {children && <Box pl={'40px'}>{children}</Box>}
    </Stack>
  )
}
