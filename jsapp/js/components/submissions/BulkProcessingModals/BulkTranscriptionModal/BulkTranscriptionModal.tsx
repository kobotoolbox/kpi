import { Anchor, Group, Stack, Text } from '@mantine/core'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ACCOUNT_ROUTES } from '#/account/routes.constants'
import type { ServerError } from '#/api/ServerError'
import { ActionIdEnum } from '#/api/models/actionIdEnum'
import {
  getAssetsAdvancedFeaturesBulkActionsListQueryKey,
  useAssetsAdvancedFeaturesBulkActionsCreate,
  useAssetsAttachmentsAudioDurationCreate,
} from '#/api/react-query/survey-data'
import {
  getOrganizationsServiceUsageRetrieveQueryKey,
  useOrganizationsServiceUsageRetrieve,
} from '#/api/react-query/user-team-organization-usage'
import Alert from '#/components/common/alert'
import RegionSelector from '#/components/languages/RegionSelector'
import { secondsToTranscriptionEstimate } from '#/components/processing/SingleProcessingContent/TabTranscript/transcript.utils'
import type { SubmissionResponse } from '#/dataInterface'
import envStore from '#/envStore'
import { useSession } from '#/stores/useSession'
import { notify } from '#/utils'
import ButtonNew from '../../../common/ButtonNew'
import LanguageSelector from '../../../languages/LanguageSelector'
import type { LanguageCode } from '../../../languages/languagesStore'
import { BulkProcessingWarningModal } from '../../BulkProcessingModals/BulkProcessingWarningModal'

const GOOGLE_TRANSCRIPTION_LANGUAGE_SUPPORT_URL = 'transcription-translation.html#language-list'
// TODO: change this to 200 when done testing
const MAXIMUM_AUDIO_DURATION_BATCH_SIZE = 20

export interface BulkTranscriptionModalProps {
  fieldId: string
  assetUid: string
  selectedSubmissions: SubmissionResponse[]
  selectedSubmissionUuids: string[]
  selectedRowsCount: number
  showWarningModal: boolean
  onRequestClose: () => void
  onSuccess: () => void
}

export function BulkTranscriptionModal(props: BulkTranscriptionModalProps) {
  const [showWarningModal, setShowWarningModal] = useState<boolean>(props.showWarningModal)
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode | null>(null)
  const [selectedRegion, setSelectedRegion] = useState<LanguageCode | null>(null)
  const [audioDuration, setAudioDuration] = useState<number>(0)
  const queryClient = useQueryClient()

  // Extract audio attachment uuids from submissions
  const attachmentUids = props.selectedSubmissions.map((submission) => submission._attachments[0].uid)
  // Create batches of 200 (do it with 10s for now)
  const attachmentUidBatches: string[][] = []
  for (let i = 0; i < attachmentUids.length; i += MAXIMUM_AUDIO_DURATION_BATCH_SIZE) {
    attachmentUidBatches.push(attachmentUids.slice(i, i + MAXIMUM_AUDIO_DURATION_BATCH_SIZE))
  }
  // Perform the logic needed w/ exp backoff per batch
  const { mutate: getAudioDurations, isPending: isAudioDurationLoading } = useAssetsAttachmentsAudioDurationCreate({
    mutation: {
      onSuccess: (response) => {
        setAudioDuration((prev) => prev + response.data.total)
      },
    },
  })

  const processBatches = async () => {
    for (let i = 0; i < attachmentUidBatches.length; i++) {
      const delay = Math.pow(2, i) * 1000 // Exponential backoff: 1s, 2s, 4s, 8s...
      await new Promise((resolve) => setTimeout(resolve, delay))

      getAudioDurations({
        uidAsset: props.assetUid,
        data: {
          attachment_uids: attachmentUidBatches[i],
        },
      })
    }
  }

  useEffect(() => {
    processBatches()
  }, [])

  const { mutate: createBulkTranscription, isPending } = useAssetsAdvancedFeaturesBulkActionsCreate({
    mutation: {
      onSuccess: () => {
        notify.success(t('Bulk transcription request submitted successfully'))

        // Invalidate the bulk actions list so React Query refetches it.
        // This triggers BulkProcessingBanner to appear (or update its count if already visible).
        queryClient.invalidateQueries({
          queryKey: getAssetsAdvancedFeaturesBulkActionsListQueryKey(props.assetUid),
        })

        props.onRequestClose()
        props.onSuccess()
      },
      onError: (error) => {
        // This custom error handler overrides the default onErrorDefaultHandler,
        // preventing the generic "400 Bad Request" notification from showing.
        // Extract the specific error message from the parsed response
        const serverError = error as ServerError
        const errorResponse = serverError.parsedResponse as {
          submission_uuids?: string[]
        }

        // Use the submission_uuids error message if available, otherwise show a generic fallback
        const errorMessage =
          errorResponse?.submission_uuids?.join(', ') || t('Failed to start transcription. Please try again.')

        notify.error(errorMessage)
      },
    },
  })
  const serviceCode = 'goog'

  const navigate = useNavigate()

  // Get organization ID to check ASR limits
  const session = useSession()
  const organizationId = session.isPending ? undefined : session.currentLoggedAccount?.organization?.uid
  const { data, isLoading: isLoadingUsage } = useOrganizationsServiceUsageRetrieve(organizationId!, {
    query: {
      queryKey: getOrganizationsServiceUsageRetrieveQueryKey(organizationId!),
      enabled: !!organizationId,
    },
  })
  const serviceUsageData = data?.status === 200 ? data.data : null
  const userAsrBalance = serviceUsageData?.balances?.asr_seconds ?? null
  const hasExceededLimit = userAsrBalance?.exceeded ?? false

  const handleLanguageChange = (language: LanguageCode | null) => {
    setSelectedLanguage(language)
    setSelectedRegion(null)
  }

  const handleRegionChange = (region: LanguageCode | null) => {
    setSelectedRegion(region)
  }

  const handleStartTranscription = () => {
    // We pass all of the submissions without filtering out the ones that have transcripts already. Currently the
    // backend skips the submissions that already have a transcript.
    createBulkTranscription({
      uidAsset: props.assetUid,
      data: {
        action_id: ActionIdEnum.automatic_google_transcription,
        question_xpath: props.fieldId,
        submission_uuids: props.selectedSubmissionUuids,
        params: {
          language: selectedLanguage!,
          locale: selectedRegion || undefined,
        },
      },
    })
  }

  const handleNavigateToAddOn = () => {
    navigate(ACCOUNT_ROUTES.ADD_ONS)
    props.onRequestClose()
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
          <Text size='sm'>
            {t(
              'Your ##count## audio files is a total of ##duration## minutes. This may take some time to complete.',
            ).replace(
              '##count##',
              String(props.selectedRowsCount).replace(
                '##duration##',
                String(secondsToTranscriptionEstimate(audioDuration)),
              ),
            )}
          </Text>

          <Group gap='sm' align='flex-start' wrap='nowrap' grow>
            <LanguageSelector
              disabled={hasExceededLimit}
              onLanguageChange={handleLanguageChange}
              value={selectedLanguage}
              required
              // Smaller message to fit in the modal
              nothingFoundMessage={t('I cannot find my language')}
            />
            <RegionSelector
              disabled={!selectedLanguage || hasExceededLimit}
              rootLanguage={selectedLanguage || ''}
              serviceCode={serviceCode}
              serviceType='transcription'
              onRegionChange={handleRegionChange}
              titleOverride={t('Select a region')}
            />
          </Group>

          {hasExceededLimit && (
            <Alert type='warning' iconName='information' mt={12} mb={12}>
              {t("You've reached your automatic transcription limit. Please purchase an add‑on to continue.")}
            </Alert>
          )}

          <Text size='xs'>
            {t('Automatic transcription is provided by Google Cloud Platform.')}
            &nbsp;
            <Anchor href={envStore.data.support_url + GOOGLE_TRANSCRIPTION_LANGUAGE_SUPPORT_URL} underline='always'>
              {t('Learn more')}
            </Anchor>
          </Text>

          <Group justify='flex-end' mt='md'>
            <ButtonNew onClick={props.onRequestClose} variant='light'>
              {t('Cancel')}
            </ButtonNew>
            {!hasExceededLimit && (
              <ButtonNew
                loading={isPending}
                onClick={handleStartTranscription}
                disabled={!selectedLanguage || isLoadingUsage}
              >
                {t('Start Transcription')}
              </ButtonNew>
            )}
            {hasExceededLimit && (
              <ButtonNew loading={isLoadingUsage} type='button' onClick={handleNavigateToAddOn} variant='light'>
                {t('Purchase add-on')}
              </ButtonNew>
            )}
          </Group>
        </Stack>
      )}
    </>
  )
}
