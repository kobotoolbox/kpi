import { Anchor, Group, Stack, Text } from '@mantine/core'
import { useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ACCOUNT_ROUTES } from '#/account/routes.constants'
import type { ServerError } from '#/api/ServerError'
import { ActionIdEnum } from '#/api/models/actionIdEnum'
import type { BulkActionResponse } from '#/api/models/bulkActionResponse'
import {
  getAssetsAdvancedFeaturesBulkActionsListQueryKey,
  useAssetsAdvancedFeaturesBulkActionsCreate,
  useAssetsAdvancedFeaturesList,
} from '#/api/react-query/survey-data'
import {
  getOrganizationsServiceUsageRetrieveQueryKey,
  useOrganizationsServiceUsageRetrieve,
} from '#/api/react-query/user-team-organization-usage'
import Alert from '#/components/common/alert'
import RegionSelector from '#/components/languages/RegionSelector'
import { getSuggestedLanguages } from '#/components/processing/common/utils'
import { getSupplementalPathParts } from '#/components/processing/processingUtils'
import type { SubmissionResponse } from '#/dataInterface'
import envStore from '#/envStore'
import { useCalculateAudioDuration } from '#/hooks/useCalculateAudioDuration.hook'
import { useSession } from '#/stores/useSession'
import { formatTimeFromSeconds, notify } from '#/utils'
import ButtonNew from '../../../common/ButtonNew'
import LanguageSelector from '../../../languages/LanguageSelector'
import type { LanguageCode } from '../../../languages/languagesStore'
import { BulkProcessingWarningModal } from '../../BulkProcessingModals/BulkProcessingWarningModal'
import BulkProcessingAlerts from '../alerts/BulkProcessingAlerts'
import { useBulkProcessingAlerts } from '../alerts/useBulkProcessingAlerts'

const GOOGLE_TRANSCRIPTION_LANGUAGE_SUPPORT_URL = 'transcription-translation.html#language-list'

function getAlreadyTranscribedMessage(count: number, duration: string): string {
  return t('##count## audio files totaling ##duration## already transcribed and will be ignored')
    .replace('##count##', String(count))
    .replace('##duration##', duration)
}

export interface BulkTranscriptionModalProps {
  fieldXpath: string
  assetUid: string
  selectedSubmissions: SubmissionResponse[]
  selectedRowsCount: number
  showWarningModal: boolean
  activeBulkActions: BulkActionResponse[]
  onRequestClose: () => void
  onSuccess: () => void
}

export function BulkTranscriptionModal(props: BulkTranscriptionModalProps) {
  const [showWarningModal, setShowWarningModal] = useState<boolean>(props.showWarningModal)
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode | null>(null)
  const [selectedRegion, setSelectedRegion] = useState<LanguageCode | null>(null)
  const queryClient = useQueryClient()

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

  // Fetch advanced features to get suggested languages
  const { data: advancedFeaturesData } = useAssetsAdvancedFeaturesList(props.assetUid)
  const advancedFeatures = advancedFeaturesData?.status === 200 ? advancedFeaturesData.data : []
  const suggestedLanguages = getSuggestedLanguages(advancedFeatures)

  const { activeAlerts, hasErrors, hasBlockingError, eligibleSubmissions } = useBulkProcessingAlerts({
    actionType: 'transcript',
    selectedSubmissions: props.selectedSubmissions,
    selectedLanguage: selectedLanguage || undefined,
    selectedRegion: selectedRegion || undefined,
    fieldXpath: props.fieldXpath,
    serviceUsageData: serviceUsageData || undefined,
    activeBulkActions: props.activeBulkActions,
  })

  const { sourceRowPath } = getSupplementalPathParts(props.fieldXpath)

  const eligibleSubmissionUuids = eligibleSubmissions.map((s) => s._uuid)

  const alreadyTranscribedSubmissionUuids = useMemo(
    () => activeAlerts.find((alert) => alert.id === 'already-transcribed')?.filteredSubmissionUuids ?? [],
    [activeAlerts],
  )

  const alreadyTranscribedSubmissions = useMemo(() => {
    if (alreadyTranscribedSubmissionUuids.length === 0) {
      return []
    }
    const uuids = new Set(alreadyTranscribedSubmissionUuids)
    return props.selectedSubmissions.filter((submission) => uuids.has(submission._uuid))
  }, [alreadyTranscribedSubmissionUuids, props.selectedSubmissions])

  const {
    duration: audioDuration,
    isLoading: isAudioDurationLoading,
    isError: isAudioDurationError,
    // TODO: For DEV-1399, we probably will want to incorporate an error message to the user telling them that we
    // couldn't calculate their ASR time remaining.
    errorMessage: audioDurationErrorMesssage,
  } = useCalculateAudioDuration({
    selectedSubmissions: eligibleSubmissions,
    fieldId: sourceRowPath,
    assetUid: props.assetUid,
  })

  const {
    duration: alreadyTranscribedDuration,
    isLoading: isAlreadyTranscribedDurationLoading,
    isError: isAlreadyTranscribedDurationError,
  } = useCalculateAudioDuration({
    selectedSubmissions: alreadyTranscribedSubmissions,
    fieldId: sourceRowPath,
    assetUid: props.assetUid,
  })

  // Keep useBulkProcessingAlerts generic, then enrich just the transcription-specific
  // "already transcribed" warning with duration text calculated in this modal.
  // All other alerts are rendered exactly as returned by the hook.
  const activeAlertsWithResolvedMinutes = useMemo(() => {
    const duration =
      isAlreadyTranscribedDurationLoading || isAlreadyTranscribedDurationError
        ? '…'
        : formatTimeFromSeconds(alreadyTranscribedDuration)

    return activeAlerts.map((alert) => {
      if (alert.id !== 'already-transcribed') {
        return alert
      }

      const computedValues = {
        ...alert.computedValues,
        duration,
      }

      return {
        ...alert,
        computedValues,
        message: getAlreadyTranscribedMessage(Number(computedValues.count ?? 0), String(computedValues.duration ?? 0)),
      }
    })
  }, [activeAlerts, alreadyTranscribedDuration, isAlreadyTranscribedDurationError, isAlreadyTranscribedDurationLoading])

  const handleLanguageChange = (language: LanguageCode | null) => {
    setSelectedLanguage(language)
    setSelectedRegion(null)
  }

  const handleRegionChange = (region: LanguageCode | null) => {
    setSelectedRegion(region)
  }

  const handleStartTranscription = () => {
    // Use eligibleSubmissionUuids from the alerts hook to filter out submissions
    // that have been flagged by warning evaluators (e.g., already transcribed, no source)
    createBulkTranscription({
      uidAsset: props.assetUid,
      data: {
        action_id: ActionIdEnum.automatic_google_transcription,
        question_xpath: sourceRowPath,
        submission_uuids: eligibleSubmissionUuids,
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
          {/* Legacy alert - will be removed once audio duration evaluators are implemented see DEV-1399 */}
          {isAudioDurationError && audioDurationErrorMesssage && (
            <Alert type='warning' iconName='information'>
              {audioDurationErrorMesssage}
            </Alert>
          )}

          <Text size='sm'>
            {t(
              'Your ##total_files## audio files is a total of ##total_length##. This may take longer to complete than the total duration of your files.',
            )
              .replace('##total_files##', String(eligibleSubmissions.length))
              .replace(
                '##total_length##',
                isAudioDurationLoading || isAudioDurationError ? '…' : formatTimeFromSeconds(audioDuration),
              )}
          </Text>

          <Group gap='sm' align='flex-start' wrap='nowrap' grow>
            <LanguageSelector
              disabled={hasExceededLimit || isLoadingUsage || hasBlockingError}
              onLanguageChange={handleLanguageChange}
              value={selectedLanguage}
              required
              suggestedLanguages={suggestedLanguages}
              // Smaller message to fit in the modal
              nothingFoundMessage={t('I cannot find my language')}
            />
            <RegionSelector
              disabled={!selectedLanguage || hasExceededLimit || isLoadingUsage || hasBlockingError}
              rootLanguage={selectedLanguage || ''}
              serviceCode={serviceCode}
              serviceType='transcription'
              onRegionChange={handleRegionChange}
              titleOverride={t('Select a region')}
            />
          </Group>

          <BulkProcessingAlerts activeAlerts={activeAlertsWithResolvedMinutes} />

          {/* Legacy alert - will be removed once evaluators are implemented */}
          {hasExceededLimit && activeAlertsWithResolvedMinutes.length === 0 && (
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
                disabled={!selectedLanguage || isLoadingUsage || hasErrors}
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
