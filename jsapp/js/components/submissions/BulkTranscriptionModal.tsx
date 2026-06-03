import { Anchor, Group, Stack, Text } from '@mantine/core'
import { modals } from '@mantine/modals'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ACCOUNT_ROUTES } from '#/account/routes.constants'
import { ActionIdEnum } from '#/api/models/actionIdEnum'
import {
  getAssetsDataListQueryKey,
  useAssetsAdvancedFeaturesBulkActionsCreate,
  useAssetsDataList,
} from '#/api/react-query/survey-data'
import {
  getOrganizationsServiceUsageRetrieveQueryKey,
  useOrganizationsServiceUsageRetrieve,
} from '#/api/react-query/user-team-organization-usage'
import Alert from '#/components/common/alert'
import type { SubmissionResponse } from '#/dataInterface'
import envStore from '#/envStore'
import { useSession } from '#/stores/useSession'
import ButtonNew from '../common/ButtonNew'
import LoadingSpinner from '../common/loadingSpinner'
import LanguageSelector from '../languages/LanguageSelector'
import RegionSelectorField from '../languages/RegionSelectorField'
import type { LanguageCode, TransxServiceCode } from '../languages/languagesStore'

const GOOGLE_TRANSCRIPTION_LANGUAGE_SUPPORT_URL = 'transcription-translation.html#language-list'

interface BulkTranscriptionModalProps {
  fieldId: string
  assetUid: string
  selectedSubmissions: SubmissionResponse[]
  selectedRowsCount: number
  selectedAllPages: boolean
  totalRowsCount: number
  onRequestClose: () => void
  submissionsToUse?: SubmissionResponse[] // Already-fetched submissions from wrapper (when fetching all)
  modalId?: string // ID of the modal so we can update its title
}

type BulkTranscriptionModalArgs = Omit<BulkTranscriptionModalProps, 'onRequestClose'>

export default function openBulkTranscriptModal(args: BulkTranscriptionModalArgs) {
  // We need a modalId in order to update the title later
  const modalId = 'bulk-transcription'

  modals.open({
    modalId,
    title: t('Transcribe selected audio files'),
    size: 'lg',
    children: (
      <BulkTranscriptionModalWrapper
        modalId={modalId}
        onRequestClose={() => {
          modals.close(modalId)
        }}
        {...args}
      />
    ),
  })
}

// Wrapper component that checks for existing transcriptions and decides which step to show. DRY way to not repeat any
// hooks that both modal steps need
function BulkTranscriptionModalWrapper(props: BulkTranscriptionModalProps) {
  const [showWarning, setShowWarning] = useState(true)

  // Only fetch all submissions if we selected all pages AND there are more rows than currently selected
  const needsToFetchAll = props.selectedAllPages && props.totalRowsCount > props.selectedSubmissions.length

  const {
    data: allSubmissionsData,
    isLoading: isLoadingAllSubmissions,
    isError: isErrorAllSubmissions,
  } = useAssetsDataList(
    props.assetUid,
    {
      fields: '["_uuid", "_supplementalDetails"]',
      limit: 30000,
    },
    {
      query: {
        queryKey: getAssetsDataListQueryKey(props.assetUid, {
          fields: '["_uuid", "_supplementalDetails"]',
          limit: 30000,
        }),
        enabled: needsToFetchAll,
        retry: false,
      },
    },
  )

  const submissionsToCheck = useMemo(() => {
    if (needsToFetchAll) {
      if (allSubmissionsData?.status === 200) {
        return allSubmissionsData.data.results
      }
      return []
    }
    return props.selectedSubmissions
  }, [needsToFetchAll, props.selectedSubmissions, allSubmissionsData])

  // Check for existing transcriptions
  const hasExistingTranscriptions = useMemo(
    () =>
      submissionsToCheck.some((submission) => {
        if (!submission._supplementalDetails) {
          return false
        }
        const fieldData = submission._supplementalDetails[props.fieldId]
        if (!fieldData || !('transcript' in fieldData)) {
          return false
        }
        if (!fieldData.transcript) {
          return false
        }
        return fieldData.transcript.value !== null && fieldData.transcript.value !== ''
      }),
    [submissionsToCheck, props.fieldId],
  )

  // Update modal title when we detect existing transcriptions
  useEffect(() => {
    if (hasExistingTranscriptions && showWarning && props.modalId) {
      modals.updateModal({
        modalId: props.modalId,
        title: t('Some audio files already transcribed'),
      })
    } else if (!hasExistingTranscriptions && props.modalId) {
      modals.updateModal({
        modalId: props.modalId,
        title: t('Transcribe selected audio files'),
      })
    }
  }, [hasExistingTranscriptions, showWarning, props.modalId])

  // Show loading while fetching data to check for existing transcriptions
  if (needsToFetchAll && isLoadingAllSubmissions) {
    return (
      <Stack gap='md' align='center' py='xl'>
        <LoadingSpinner />
        <Text size='sm'>{t('Checking submissions...')}</Text>
      </Stack>
    )
  }

  if (isErrorAllSubmissions) {
    return (
      <Alert type='error' iconName='alert' mt={12} mb={12}>
        {t('Failed to load all submissions. Please try again or select submissions from the current page only.')}
      </Alert>
    )
  }

  // If there are existing transcriptions and we haven't confirmed yet, show warning
  if (hasExistingTranscriptions && showWarning) {
    return (
      <Stack gap='md'>
        <Text size='sm'>
          {t(
            "You've selected audio files that already have transcripts. Those files will be skipped. Transcripts will only be generated for files without existing transcripts.",
          )}
        </Text>

        <Alert type='warning' iconName='information' p='md'>
          {t('If you continue, existing transcripts will remain unchanged.')}
        </Alert>

        <Group justify='flex-end' mt='md'>
          <ButtonNew onClick={props.onRequestClose} variant='light'>
            {t('Cancel')}
          </ButtonNew>
          <ButtonNew onClick={() => setShowWarning(false)} variant='filled'>
            {t('Continue')}
          </ButtonNew>
        </Group>
      </Stack>
    )
  }

  // Show the main transcription modal, passing down the already-fetched submissions
  return <BulkTranscriptionModal {...props} submissionsToUse={submissionsToCheck as SubmissionResponse[]} />
}

function BulkTranscriptionModal(props: BulkTranscriptionModalProps) {
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode | null>(null)
  const [selectedRegion, setSelectedRegion] = useState<LanguageCode | null>(null)
  const [serviceCode] = useState<TransxServiceCode>('goog')
  const { mutate: createBulkTranscription, isPending } = useAssetsAdvancedFeaturesBulkActionsCreate()

  // Get organization ID from session
  const session = useSession()
  const organizationId = session.isPending ? undefined : session.currentLoggedAccount?.organization?.uid
  const { data, isLoading: isLoadingUsage } = useOrganizationsServiceUsageRetrieve(organizationId!, {
    query: {
      queryKey: getOrganizationsServiceUsageRetrieveQueryKey(organizationId!),
      enabled: !!organizationId,
    },
  })

  const navigate = useNavigate()

  // Get the submission UUIDs - use submissionsToUse if provided (from wrapper), otherwise use selectedSubmissions
  const submissionUuids = useMemo(() => {
    const submissions = props.submissionsToUse || props.selectedSubmissions
    return submissions.map((submission) => submission._uuid)
  }, [props.submissionsToUse, props.selectedSubmissions])

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
    createBulkTranscription(
      {
        uidAsset: props.assetUid,
        data: {
          action_id: ActionIdEnum.automatic_google_transcription,
          question_xpath: props.fieldId,
          submission_uuids: submissionUuids,
          params: {
            language: selectedLanguage!,
            locale: selectedRegion || undefined,
          },
        },
      },
      {
        onSuccess: () => {
          // TODO: implement @mantine/notifications system, see DEV-2211
          props.onRequestClose()
        },
        onError: () => {
          // TODO: implement @mantine/notifications system, see DEV-2211
        },
      },
    )
  }

  const handlePurchaseAddOn = () => {
    navigate(ACCOUNT_ROUTES.ADD_ONS)
    props.onRequestClose()
  }

  return (
    <Stack gap='md'>
      <Text size='sm'>
        {t('##count## audio files selected for transcription. This may take some time to complete.').replace(
          '##count##',
          String(props.selectedRowsCount),
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
        <RegionSelectorField
          disabled={!selectedLanguage || hasExceededLimit}
          rootLanguage={selectedLanguage || ''}
          serviceCode={serviceCode}
          serviceType='transcription'
          onRegionChange={handleRegionChange}
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
          <ButtonNew loading={isPending} onClick={handleStartTranscription} disabled={!selectedLanguage}>
            {t('Start Transcription')}
          </ButtonNew>
        )}
        {hasExceededLimit && (
          <ButtonNew loading={isLoadingUsage} type='button' onClick={handlePurchaseAddOn} variant='light'>
            {t('Purchase add-on')}
          </ButtonNew>
        )}
      </Group>
    </Stack>
  )
}
