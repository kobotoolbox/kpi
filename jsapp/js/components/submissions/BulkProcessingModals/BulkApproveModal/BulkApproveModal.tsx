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
import BulkProcessingAlerts from '../alerts/BulkProcessingAlerts'
import { useBulkProcessingAlerts } from '../alerts/useBulkProcessingAlerts'

export interface BulkApproveModalProps {
  fieldXpath: string
  assetUid: string
  selectedRowsCount: number
  showWarningModal: boolean
  onRequestClose: () => void
  onSuccess: () => void
  selectedSubmissions: SubmissionResponse[]
}

export function BulkApproveModal(props: BulkApproveModalProps) {
  const [showWarningModal, setShowWarningModal] = useState<boolean>(props.showWarningModal)
  const queryClient = useQueryClient()

  // Determine if this is a transcript or translation column
  const supplementalPathParts = getSupplementalPathParts(props.fieldXpath)
  const isTranslationColumn = supplementalPathParts.type === 'translation'
  const language = supplementalPathParts.languageCode

  // Both the count we show and the uuids we send come from here, so the modal can't
  // promise to approve more submissions than it actually will.
  const { activeAlerts, eligibleSubmissions, eligibleSubmissionUuids, hasErrors } = useBulkProcessingAlerts({
    actionType: 'approve',
    selectedSubmissions: props.selectedSubmissions,
    fieldXpath: props.fieldXpath,
  })

  const { mutate: bulkApprove, isPending } = useAssetsDataSupplementsBulkCreate({
    mutation: {
      onSuccess: (response) => {
        const acceptedCount = response.status === 200 ? response.data.accepted_count : 0

        if (acceptedCount > 0) {
          notify.success(t('Successfully approved ##count## submission(s)').replace('##count##', String(acceptedCount)))
        } else {
          // We only send submissions that need approval, so if we end up here they
          // got approved somewhere else while this modal was open.
          notify.warning(t('No submissions were approved. They have been approved already.'))
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
          errorResponse?.submission_uids?.join(', ') || t('Failed to approve submissions. Please try again.')

        notify.error(errorMessage)
      },
    },
  })

  const handleApproveSubmissions = () => {
    // Extract the source row path from the transcript/translation column path
    // e.g., "_supplementalDetails/q1/transcript_en" -> "q1"
    // or "_supplementalDetails/q1/translation_fr" -> "q1"
    const { sourceRowPath } = getSupplementalPathParts(props.fieldXpath)

    // Determine action_id based on column type
    const actionId = isTranslationColumn
      ? ActionIdEnum.automatic_google_translation
      : ActionIdEnum.automatic_google_transcription

    bulkApprove({
      uidAsset: props.assetUid,
      data: {
        // Only the submissions that still need approval. The backend skips the rest
        // anyway, and sending them would make the count we showed wrong.
        submission_uids: eligibleSubmissionUuids,
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
            <Text>
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

          {/*
            On purpose we don't say "selected" here, because this number only counts
            the rows that need approval, which can be fewer than what was selected.
          */}
          <Text>
            {isTranslationColumn &&
              (eligibleSubmissions.length === 1
                ? t('Do you want to approve 1 translation?')
                : t('Do you want to approve ##count## translations?').replace(
                    '##count##',
                    String(eligibleSubmissions.length),
                  ))}
            {!isTranslationColumn &&
              (eligibleSubmissions.length === 1
                ? t('Do you want to approve 1 transcript?')
                : t('Do you want to approve ##count## transcripts?').replace(
                    '##count##',
                    String(eligibleSubmissions.length),
                  ))}
          </Text>

          <BulkProcessingAlerts activeAlerts={activeAlerts} />

          <Group justify='flex-end' mt='md'>
            <ButtonNew onClick={props.onRequestClose} variant='light' disabled={isPending}>
              {t('Cancel')}
            </ButtonNew>
            <ButtonNew loading={isPending} onClick={handleApproveSubmissions} disabled={hasErrors}>
              {t('Approve')}
            </ButtonNew>
          </Group>
        </Stack>
      )}
    </>
  )
}
