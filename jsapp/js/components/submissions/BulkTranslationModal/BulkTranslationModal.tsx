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
import type { SubmissionResponse } from '#/dataInterface'
import envStore from '#/envStore'
import { useSession } from '#/stores/useSession'
import ButtonNew from '../../common/ButtonNew'
import LanguageSelector from '../../languages/LanguageSelector'
import type { LanguageCode } from '../../languages/languagesStore'
import { getSupplementalDetailsContent } from '../submissionUtils'

const GOOGLE_TRANSCRIPTION_LANGUAGE_SUPPORT_URL = 'transcription-translation.html#language-list'

export interface BulkTranslationModalProps {
  fieldId: string
  assetUid: string
  selectedRowsCount: number
  showWarningModal: boolean
  onRequestClose: () => void
  onSuccess: () => void
  selectedSubmissions: SubmissionResponse[]
}

export function BulkTranslationModal(props: BulkTranslationModalProps) {
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode | null>(null)
  const { mutate: createBulkTranslation, isPending } = useAssetsAdvancedFeaturesBulkActionsCreate()

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
  }

  const totalCharacters = props.selectedSubmissions.reduce((sum, sub) => {
    const supplementalValue = getSupplementalDetailsContent(sub, props.fieldId) || ''
    return sum + supplementalValue.length
  }, 0)
  const selectedSubmissionUuids = props.selectedSubmissions.map((submission) => submission._uuid)

  const handleStartTranslation = () => {
    // We pass all of the submissions without filtering out the ones that have transcripts already. Currently the
    // backend skips the submissions that already have a transcript.
    createBulkTranslation(
      {
        uidAsset: props.assetUid,
        data: {
          action_id: ActionIdEnum.automatic_google_translation,
          question_xpath: props.fieldId,
          submission_uuids: selectedSubmissionUuids,
          params: {
            language: selectedLanguage!,
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

  return (
    <Stack gap='md'>
      <Text size='sm'>
        {t(
          '##count## transcripts selected, totalling ##totalCharacters## characters. This will take some time to complete.',
        )
          .replace('##count##', String(props.selectedRowsCount))
          .replace('##totalCharacters##', String(totalCharacters))}
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
      </Group>

      {hasExceededLimit && (
        <Alert type='warning' iconName='information' mt={12} mb={12}>
          {t("You've reached your automatic translation limit. Please purchase an add‑on to continue.")}
        </Alert>
      )}

      <Text size='xs'>
        {t('Automatic translation is provided by Google Cloud Platform.')}
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
            onClick={handleStartTranslation}
            disabled={!selectedLanguage || isLoadingUsage}
          >
            {t('Create translations')}
          </ButtonNew>
        )}
        {hasExceededLimit && (
          <ButtonNew loading={isLoadingUsage} type='button' onClick={handleNavigateToAddOn} variant='light'>
            {t('Purchase add-on')}
          </ButtonNew>
        )}
      </Group>
    </Stack>
  )
}
