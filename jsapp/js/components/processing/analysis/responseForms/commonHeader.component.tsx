import React, { useState, useContext } from 'react'

import { Group, Modal, Stack, Text, Title } from '@mantine/core'
import { Box, ThemeIcon } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import clonedeep from 'lodash.clonedeep'
import { handleApiFail } from '#/api'
import ActionIcon from '#/components/common/ActionIcon'
import ButtonNew from '#/components/common/ButtonNew'
import Icon from '#/components/common/icon'
import AnalysisQuestionsContext from '#/components/processing/analysis/analysisQuestions.context'
import {
  findQuestion,
  getQuestionTypeDefinition,
  getQuestionsFromSchema,
  hasManagePermissionsToCurrentAsset,
  updateSurveyQuestions,
} from '#/components/processing/analysis/utils'
import type { FailResponse } from '#/dataInterface'
import singleProcessingStore from '../../singleProcessingStore'
import type { AnalysisQuestionInternal } from '../constants'
import commonStyles from './common.module.scss'

interface ResponseFormHeaderProps {
  uuid: string
  children?: React.ReactNode
}

/**
 * Displays question type icon, name, and an edit and delete buttons (if user
 * has sufficient permissions). Is being used in multiple other components.
 */
export default function ResponseFormHeader(props: ResponseFormHeaderProps) {
  const [opened, { open, close }] = useDisclosure(false)
  const analysisQuestions = useContext(AnalysisQuestionsContext)
  if (!analysisQuestions) {
    return null
  }

  // Get the question data from state (with safety check)
  const question = findQuestion(props.uuid, analysisQuestions.state)
  if (!question) {
    return null
  }

  // Get the question definition (with safety check)
  const qaDefinition = getQuestionTypeDefinition(question.type)
  if (!qaDefinition) {
    return null
  }

  const [isDeletePromptOpen, setIsDeletePromptOpen] = useState(false)

  /**
   * Means that user clicked "Edit" button and wants to start modyfing
   * the question definition.
   */
  function openQuestionInEditor() {
    analysisQuestions?.dispatch({
      type: 'startEditingQuestion',
      payload: { uuid: props.uuid },
    })
  }

  async function deleteQuestion() {
    analysisQuestions?.dispatch({
      type: 'deleteQuestion',
      payload: { uuid: props.uuid },
    })

    setIsDeletePromptOpen(false)

    // Step 1: ensure no mutations happen
    const newQuestions: AnalysisQuestionInternal[] = clonedeep(analysisQuestions?.state.questions) || []

    // Step 2: set `deleted` flag on the question
    newQuestions.forEach((item: AnalysisQuestionInternal) => {
      if (item.uuid === props.uuid) {
        if (typeof item.options !== 'object') {
          item.options = {}
        }
        item.options.deleted = true
      }
    })

    try {
      // Step 3: update asset endpoint with new questions
      const response = await updateSurveyQuestions(singleProcessingStore.currentAssetUid, newQuestions)

      // Step 4: update reducer's state with new list after the call finishes
      analysisQuestions?.dispatch({
        type: 'deleteQuestionCompleted',
        payload: {
          questions: getQuestionsFromSchema(response?.advanced_features),
        },
      })
    } catch (err) {
      handleApiFail(err as FailResponse)
      analysisQuestions?.dispatch({ type: 'udpateQuestionFailed' })
    }
  }

  return (
    <Box>
      <Group className={commonStyles.header}>
        <Modal opened={opened} onClose={close} title={t('Delete this question?')} size={'md'}>
          <Stack>
            <Text>{t('Are you sure you want to delete this question? This action cannot be undone.')}</Text>
            <Group align='left'>
              <ButtonNew size='md' onClick={close} variant='light'>
                {t('Cancel')}
              </ButtonNew>

              <ButtonNew size='md' onClick={deleteQuestion} variant='danger'>
                {t('Delete account')}
              </ButtonNew>
            </Group>
          </Stack>
        </Modal>

        <ThemeIcon variant='light-teal'>
          <Icon name={qaDefinition.icon} size='xl' />
        </ThemeIcon>

        <Title className={commonStyles.headerLabel}>{question.labels._default}</Title>

        <ActionIcon
          variant='light'
          color=''
          size='sm'
          iconName='edit'
          onClick={openQuestionInEditor}
          // We only allow editing one question at a time, so adding new is not
          // possible until user stops editing
          disabled={
            !hasManagePermissionsToCurrentAsset() ||
            analysisQuestions.state.questionsBeingEdited.length !== 0 ||
            analysisQuestions.state.isPending
          }
        />

        <ActionIcon
          variant='danger-secondary'
          size='sm'
          iconName='trash'
          onClick={open}
          disabled={!hasManagePermissionsToCurrentAsset() || analysisQuestions.state.isPending}
        />
      </Group>

      {props.children && <Box className={commonStyles.content}>{props.children}</Box>}
    </Box>
  )
}
