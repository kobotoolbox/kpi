import { Anchor, Group, Stack, Text } from '@mantine/core'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ACCOUNT_ROUTES } from '#/account/routes.constants'
import { ActionIdEnum } from '#/api/models/actionIdEnum'
import { useAssetsAdvancedFeaturesBulkActionsCreate } from '#/api/react-query/survey-data'
import {
  getOrganizationsServiceUsageRetrieveQueryKey,
  useOrganizationsServiceUsageRetrieve,
} from '#/api/react-query/user-team-organization-usage'
import Alert from '#/components/common/alert'
import envStore from '#/envStore'
import { useSession } from '#/stores/useSession'
import ButtonNew from '../../common/ButtonNew'
import LanguageSelector from '../../languages/LanguageSelector'
import RegionSelector from '../../languages/RegionSelector'
import type { LanguageCode } from '../../languages/languagesStore'

const GOOGLE_TRANSCRIPTION_LANGUAGE_SUPPORT_URL = 'transcription-translation.html#language-list'

export interface BulkTranscriptionModalProps {
  fieldId: string
  assetUid: string
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
  const { mutate: createBulkTranscription, isPending } = useAssetsAdvancedFeaturesBulkActionsCreate()
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
          // TODO: implement @mantine/notifications system, see DEV-1412
          props.onRequestClose()
          props.onSuccess()
        },
        onError: () => {
          // TODO: implement @mantine/notifications system, see DEV-1412
        },
      },
    )
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
        <Stack gap='md'>
          <Text size='sm'>
            {t(
              'This bulk processing request is too large and could affect the performance of the application. Only the results currently visible in the data table (##count##) will be processed.',
            ).replace('##count##', String(props.selectedRowsCount))}
          </Text>

          <Alert type='info' iconName='information' m={0}>
            {t('To increase the number of files processed, increase the number of rows displayed in the table')}
          </Alert>
          <Group justify='flex-end' mt='md'>
            <ButtonNew onClick={props.onRequestClose} variant='light'>
              {t('Cancel')}
            </ButtonNew>
            <ButtonNew
              onClick={handleWarningContinue}
            >
              {t('Continue')}
            </ButtonNew>
          </Group>
        </Stack>
      )}
      {!showWarningModal && (
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
