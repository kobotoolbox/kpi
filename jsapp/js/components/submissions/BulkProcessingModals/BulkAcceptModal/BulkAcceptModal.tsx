import { Group, Stack, Text } from '@mantine/core'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { actions } from '#/actions'
import type { ServerError } from '#/api/ServerError'
import { ActionIdEnum } from '#/api/models/actionIdEnum'
import { OperationEnum } from '#/api/models/operationEnum'
import {
  getAssetsAdvancedFeaturesBulkActionsListQueryKey,
  useAssetsDataSupplementsBulkCreate,
} from '#/api/react-query/survey-data'
import ButtonNew from '#/components/common/ButtonNew'
import Alert from '#/components/common/alert'
import { getSupplementalPathParts } from '#/components/processing/processingUtils'
import { BulkProcessingWarningModal } from '#/components/submissions/BulkProcessingModals/BulkProcessingWarningModal'
import type { SubmissionResponse } from '#/dataInterface'
import { notify } from '#/utils'

export interface BulkAcceptModalProps {
  fieldXpath: string
  assetUid: string
  selectedRowsCount: number
  showWarningModal: boolean
  onRequestClose: () => void
  onSuccess: () => void
  selectedSubmissions: SubmissionResponse[]
}

export function BulkAcceptModal(props: BulkAcceptModalProps) {
  const [showWarningModal, setShowWarningModal] = useState<boolean>(props.showWarningModal)
  const queryClient = useQueryClient()

  // Determine if this is a transcript or translation column
  const supplementalPathParts = getSupplementalPathParts(props.fieldXpath)
  const isTranslationColumn = supplementalPathParts.type === 'translation'
  const language = supplementalPathParts.languageCode

  const { mutate: bulkAccept, isPending } = useAssetsDataSupplementsBulkCreate({
    mutation: {
      onSuccess: (response) => {
        const acceptedCount = response.status === 200 ? response.data.accepted_count : 0

        if (acceptedCount > 0) {
          notify.success(t('Successfully accepted ##count## submission(s)').replace('##count##', String(acceptedCount)))
        } else {
          notify.warning(t('No submissions were accepted. They may already be accepted or have no data.'))
        }

        // Invalidate the bulk actions list so React Query refetches it.
        queryClient.invalidateQueries({
          queryKey: getAssetsAdvancedFeaturesBulkActionsListQueryKey(props.assetUid),
        })

        // Trigger table refresh to show updated acceptance status
        actions.resources.refreshTableSubmissions()

        props.onRequestClose()
        props.onSuccess()
      },

      onError: (error) => {
        // This custom error handler overrides the default onErrorDefaultHandler,
        // preventing the generic "400 Bad Request" notification from showing.
        // Extract the specific error message from the parsed response
        const serverError = error as ServerError

        const errorResponse = serverError.parsedResponse as {
          submission_uids?: string[]
        }

        // Use the submission_uids error message if available, otherwise show a generic fallback
        const errorMessage =
          errorResponse?.submission_uids?.join(', ') || t('Failed to accept submissions. Please try again.')

        notify.error(errorMessage)
      },
    },
  })

  const handleAcceptSubmissions = () => {
    // Extract the source row path from the transcript/translation column path
    // e.g., "_supplementalDetails/q1/transcript_en" -> "q1"
    // or "_supplementalDetails/q1/translation_fr" -> "q1"
    const { sourceRowPath } = getSupplementalPathParts(props.fieldXpath)

    // Get submission UUIDs (_uuid) from selected submissions
    const submissionUids = props.selectedSubmissions.map((submission) => submission._uuid)

    // Determine action_id based on column type
    const actionId = isTranslationColumn
      ? ActionIdEnum.automatic_google_translation
      : ActionIdEnum.automatic_google_transcription

    bulkAccept({
      uidAsset: props.assetUid,
      data: {
        submission_uids: submissionUids,
        question_xpath: sourceRowPath,
        action_id: actionId,
        ...(isTranslationColumn && language ? { language } : {}),
        operation: OperationEnum.accept,
      },
    })
  }

  const handleWarningContinue = () => {
    setShowWarningModal(!showWarningModal)
  }

  return (
    <>
      {showWarningModal && (
        <BulkProcessingWarningModal
          selectedRowsCount={props.selectedRowsCount}
          onRequestClose={props.onRequestClose}
          handleWarningContinue={handleWarningContinue}
        />
      )}

      {!showWarningModal && (
        <Stack gap='md'>
          <Alert type='info' iconName='information'>
            <Text size='sm'>
              {isTranslationColumn &&
                t(
                  'The selected translations were automatically generated and should be reviewed to ensure accuracy. Once approved, they will be saved and displayed in your data table.',
                )}
              {!isTranslationColumn &&
                t(
                  'The selected transcripts were automatically generated and should be reviewed to ensure accuracy. Once approved, they will be saved and displayed in your data table.',
                )}
            </Text>
          </Alert>

          <Text size='sm'>
            {isTranslationColumn &&
              t('Do you want to approve the ##count## translations selected?').replace(
                '##count##',
                String(props.selectedSubmissions.length),
              )}
            {!isTranslationColumn &&
              t('Do you want to approve the ##count## transcripts selected?').replace(
                '##count##',
                String(props.selectedSubmissions.length),
              )}
          </Text>

          <Group justify='flex-end' mt='md'>
            <ButtonNew onClick={props.onRequestClose} variant='light' disabled={isPending}>
              {t('Cancel')}
            </ButtonNew>
            <ButtonNew loading={isPending} onClick={handleAcceptSubmissions}>
              {t('Approve')}
            </ButtonNew>
          </Group>
        </Stack>
      )}
    </>
  )
}
