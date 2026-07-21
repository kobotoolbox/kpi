import { Anchor, Group, Stack, Text } from '@mantine/core'
import { useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
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
import ButtonNew from '#/components/common/ButtonNew'
import LanguageSelector from '#/components/languages/LanguageSelector'
import type { LanguageCode } from '#/components/languages/languagesStore'
import { getSuggestedLanguages } from '#/components/processing/common/utils'
import { getSupplementalPathParts } from '#/components/processing/processingUtils'
import { BulkProcessingWarningModal } from '#/components/submissions/BulkProcessingModals/BulkProcessingWarningModal'
import { getSupplementalDetailsContent } from '#/components/submissions/submissionUtils'
import type { SubmissionResponse } from '#/dataInterface'
import envStore from '#/envStore'
import { useSession } from '#/stores/useSession'
import { notify } from '#/utils'
import BulkProcessingAlerts from '../alerts/BulkProcessingAlerts'
import { useBulkProcessingAlerts } from '../alerts/useBulkProcessingAlerts'

const GOOGLE_TRANSCRIPTION_LANGUAGE_SUPPORT_URL = 'transcription-translation.html#language-list'

export interface BulkTranslationModalProps {
  fieldXpath: string
  assetUid: string
  selectedRowsCount: number
  showWarningModal: boolean
  activeBulkActions: BulkActionResponse[]
  onRequestClose: () => void
  onSuccess: () => void
  selectedSubmissions: SubmissionResponse[]
}

export function BulkTranslationModal(props: BulkTranslationModalProps) {
  const [showWarningModal, setShowWarningModal] = useState<boolean>(props.showWarningModal)
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode | null>(null)
  const queryClient = useQueryClient()

  const { mutate: createBulkTranslation, isPending } = useAssetsAdvancedFeaturesBulkActionsCreate({
    mutation: {
      onSuccess: () => {
        notify.success(t('Bulk translation request submitted successfully'))

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
          errorResponse?.submission_uuids?.join(', ') || t('Failed to start translation. Please try again.')

        notify.error(errorMessage)
      },
    },
  })

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
  const userMtBalance = serviceUsageData?.balances?.mt_characters ?? null
  const hasExceededLimit = userMtBalance?.exceeded ?? false

  // Fetch advanced features to get suggested languages
  const { data: advancedFeaturesData } = useAssetsAdvancedFeaturesList(props.assetUid)
  const advancedFeatures = advancedFeaturesData?.status === 200 ? advancedFeaturesData.data : []
  const suggestedLanguages = getSuggestedLanguages(advancedFeatures)

  const { sourceRowPath } = getSupplementalPathParts(props.fieldXpath)

  // Use bulk processing alerts hook
  // Near-limit should reflect only the submissions that still need translation.
  // Rows that already have a translation in the selected language will be filtered
  // out by the alert pipeline, so we exclude them here as well to keep the limit check aligned.
  const requiredCharacters = useMemo(() => {
    if (!selectedLanguage) {
      return undefined
    }

    return props.selectedSubmissions.reduce((sum, sub) => {
      const supplementalDetails = sub._supplementalDetails?.[sourceRowPath]
      const translation = supplementalDetails?.translation?.[selectedLanguage]

      if (translation?.value) {
        // This row is already translated in the chosen language and won't consume MT quota.
        return sum
      }

      const supplementalValue = getSupplementalDetailsContent(sub, props.fieldXpath) || ''
      return sum + supplementalValue.length
    }, 0)
  }, [props.selectedSubmissions, props.fieldXpath, selectedLanguage, sourceRowPath])

  const { activeAlerts, hasErrors, hasBlockingError, eligibleSubmissions } = useBulkProcessingAlerts({
    actionType: 'translation',
    selectedSubmissions: props.selectedSubmissions,
    selectedLanguage: selectedLanguage || undefined,
    fieldXpath: props.fieldXpath,
    requiredAmount: requiredCharacters,
    serviceUsageData: serviceUsageData || undefined,
    activeBulkActions: props.activeBulkActions,
  })

  const handleLanguageChange = (language: LanguageCode | null) => {
    setSelectedLanguage(language)
  }

  const totalCharacters = eligibleSubmissions.reduce((sum, sub) => {
    const supplementalValue = getSupplementalDetailsContent(sub, props.fieldXpath) || ''
    return sum + supplementalValue.length
  }, 0)
  const eligibleSubmissionUuids = eligibleSubmissions.map((submission) => submission._uuid)

  const handleStartTranslation = () => {
    // Use eligibleSubmissionUuids from the alerts hook to filter out submissions
    // that have been flagged by warning evaluators (e.g., already translated, no source)
    createBulkTranslation({
      uidAsset: props.assetUid,
      data: {
        action_id: ActionIdEnum.automatic_google_translation,
        question_xpath: sourceRowPath,
        submission_uuids: eligibleSubmissionUuids,
        params: {
          language: selectedLanguage!,
        },
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
          <Text size='sm'>
            {t(
              'Your ##total_selected## transcripts is a total of ##total_characters## characters. This may take some time to complete.',
            )
              .replace('##total_selected##', String(eligibleSubmissions.length))
              .replace('##total_characters##', String(totalCharacters))}
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
          </Group>

          <BulkProcessingAlerts activeAlerts={activeAlerts} />

          <Text size='xs'>
            {t('Automatic translation is provided by Google Cloud Platform.')}
            &nbsp;
            <Anchor
              target='_blank'
              href={envStore.data.support_url + GOOGLE_TRANSCRIPTION_LANGUAGE_SUPPORT_URL}
              underline='always'
            >
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
                onClick={handleStartTranslation}
                disabled={!selectedLanguage || isLoadingUsage || hasErrors}
              >
                {t('Create translations')}
              </ButtonNew>
            )}
            {hasExceededLimit && (
              <ButtonNew
                loading={isLoadingUsage}
                type='button'
                variant='light'
                component={Link}
                to={ACCOUNT_ROUTES.ADD_ONS}
                onClick={props.onRequestClose}
              >
                {t('Purchase add-on')}
              </ButtonNew>
            )}
          </Group>
        </Stack>
      )}
    </>
  )
}
