import { Anchor, Group, Stack, Text } from '@mantine/core'
import { modals } from '@mantine/modals'
import { useMemo, useState } from 'react'
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
}

type BulkTranscriptionModalArgs = Omit<BulkTranscriptionModalProps, 'onRequestClose'> & {
  hasExistingTranscriptions: boolean
}

export default function openBulkTranscriptModal(args: BulkTranscriptionModalArgs) {
  // If there are existing transcripts, show warning modal first
  if (args.hasExistingTranscriptions) {
    const warningModalId = modals.openConfirmModal({
      title: t('Some audio files already transcribed'),
      size: 'lg',
      children: (
        <Stack gap='sm'>
          <Text size='sm'>
            {t(
              'You’ve selected audio files that already have transcripts. Those files will be skipped. Transcripts will only be generated for files without existing transcripts.',
            )}
          </Text>

          <Alert type='warning' iconName='information' p='md'>
            {t('If you continue, existing transcripts will remain unchanged.')}
          </Alert>
        </Stack>
      ),
      labels: {
        confirm: t('Continue'),
        cancel: t('Cancel'),
      },
      confirmProps: {
        variant: 'filled',
      },
      cancelProps: {
        variant: 'light',
      },
      onConfirm: () => {
        modals.close(warningModalId)
        openBulkTranscriptModalInternal(args)
      },
    })
    return
  }

  openBulkTranscriptModalInternal(args)
}

// Internal function that opens the actual transcription modal
function openBulkTranscriptModalInternal(args: BulkTranscriptionModalArgs) {
  const modalId = modals.open({
    title: t('Transcribe selected audio files'),
    size: 'lg',
    children: (
      <BulkTranscriptionModal
        onRequestClose={() => {
          modals.close(modalId)
        }}
        {...args}
      />
    ),
  })
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

  // Only fetch all submissions if we selected all pages AND there are more rows than currently selected
  const needsToFetchAll = props.selectedAllPages && props.totalRowsCount > props.selectedSubmissions.length

  const {
    data: allSubmissionsData,
    isLoading: isLoadingAllSubmissions,
    isError: isErrorAllSubmissions,
  } = useAssetsDataList(
    props.assetUid,
    {
      fields: '["_uuid"]',
      limit: 30000,
    },
    {
      query: {
        queryKey: getAssetsDataListQueryKey(props.assetUid, { fields: '["_uuid"]', limit: 30000 }),
        enabled: needsToFetchAll,
        retry: false,
      },
    },
  )

  // Get the submission UUIDs based on whether we need to fetch all
  const submissionUuids = useMemo(() => {
    if (needsToFetchAll) {
      if (allSubmissionsData?.status === 200) {
        return allSubmissionsData.data.results.map((submission) => submission._uuid)
      }
      return []
    }
    return props.selectedSubmissions.map((submission) => submission._uuid)
  }, [needsToFetchAll, props.selectedSubmissions, allSubmissionsData])

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

  // Show loading spinner while fetching all submissions (only when we actually need to fetch)
  if (needsToFetchAll && isLoadingAllSubmissions) {
    return (
      <Stack gap='md' align='center' py='xl'>
        <LoadingSpinner />
        <Text size='sm'>{t('Loading submissions...')}</Text>
      </Stack>
    )
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
          {t('You’ve reached your automatic transcription limit. Please purchase an add‑on to continue.')}
        </Alert>
      )}
      {isErrorAllSubmissions && (
        <Alert type='error' iconName='alert' mt={12} mb={12}>
          {t('Failed to load all submissions. Please try again or select submissions from the current page only.')}
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
            disabled={!selectedLanguage || isErrorAllSubmissions}
          >
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
