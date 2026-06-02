import { Anchor, Group, Stack, Text } from '@mantine/core'
import { modals } from '@mantine/modals'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ACCOUNT_ROUTES } from '#/account/routes.constants'
import { ActionIdEnum } from '#/api/models/actionIdEnum'
import { useAssetsAdvancedFeaturesBulkActionsCreate } from '#/api/react-query/survey-data'
import { useServiceUsageList } from '#/api/react-query/user-team-organization-usage'
import Alert from '#/components/common/alert'
import ButtonNew from '../common/ButtonNew'
import LanguageSelector from '../languages/LanguageSelector'
import RegionSelectorField from '../languages/RegionSelectorField'
import type { LanguageCode, TransxServiceCode } from '../languages/languagesStore'
import envStore from '#/envStore'

const TRANSX_GOOG_SUPPORT_URL = 'transcription-translation.html#language-list'

interface BulkTranscriptionModalProps {
  fieldId: string
  assetUid: string
  selectedSubmissionUuids: string[]
  selectedRowsCount: number
  selectedAllPages: boolean
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
  const { data, isLoading: isLoadingUsage } = useServiceUsageList()

  const navigate = useNavigate()

  // TODO: API returns a single object, but orval types say it's an array, fix this when DEV-2208 is done
  const serviceUsageData = data?.status === 200 ? (data.data as any) : null
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
          submission_uuids: props.selectedSubmissionUuids,
          params: {
            language: selectedLanguage!,
            locale: selectedRegion || undefined,
          },
        },
      },
      {
        onSuccess: () => {
          // TODO: notifications
          props.onRequestClose()
        },
        onError: (error) => {
          // TODO: notifications
          console.error('Transcription failed:', error)
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
          {t('You’ve reached your automatic transcription limit. Please purchase an add‑on to continue.')}
        </Alert>
      )}

      <Text size='xs'>
        {t('Automatic transcription is provided by Google Cloud Platform.')}
        &nbsp;
        <Anchor href={envStore.data.support_url + TRANSX_GOOG_SUPPORT_URL} underline='always'>
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
