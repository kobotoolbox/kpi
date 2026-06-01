import { Group, Stack, Text } from '@mantine/core'
import { modals } from '@mantine/modals'
import { useState } from 'react'
import { ActionIdEnum } from '#/api/models/actionIdEnum'
import { useAssetsAdvancedFeaturesBulkActionsCreate } from '#/api/react-query/survey-data'
import ButtonNew from '../common/ButtonNew'
import LanguageSelector from '../languages/LanguageSelector'
import RegionSelectorField from '../languages/RegionSelectorField'
import type { LanguageCode, TransxServiceCode } from '../languages/languagesStore'

interface BulkTranscriptionModalProps {
  fieldId: string
  assetUid: string
  selectedSubmissionUuids: string[]
  selectedRowsCount: number
  selectedAllPages: boolean
  onRequestClose: () => void
}

type BulkTranscriptionModalArgs = Omit<BulkTranscriptionModalProps, 'onRequestClose'>

const REQUIRED_ASTERISK_OFFSET = 4

export function openBulkTranscriptModal(args: BulkTranscriptionModalArgs) {
  const modalId = modals.open({
    title: t('Transcribe selected audio files'),
    size: 'md',
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

export default function BulkTranscriptionModal(props: BulkTranscriptionModalProps) {
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode | null>(null)
  const [selectedRegion, setSelectedRegion] = useState<LanguageCode | null>(null)
  const [serviceCode] = useState<TransxServiceCode>('goog')
  const { mutate: createBulkTranscription, isPending } = useAssetsAdvancedFeaturesBulkActionsCreate()
  const handleLanguageChange = (language: LanguageCode | null) => {
    setSelectedLanguage(language)
    // Reset region when language changes
    setSelectedRegion(null)
  }

  const handleRegionChange = (region: LanguageCode | null) => {
    setSelectedRegion(region)
  }

  const handleCancelLanguage = () => {
    setSelectedLanguage(null)
    setSelectedRegion(null)
  }

  const handleStartTranscription = () => {
    createBulkTranscription(
      {
        uidAsset: props.assetUid, // You'll need to get this from props or context
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
          // Show success message
          props.onRequestClose()
        },
        onError: (error) => {
          // Handle error
          console.error('Transcription failed:', error)
        },
      },
    )
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

      <Group gap='sm' align='flex-start' wrap='nowrap'>
        <LanguageSelector onLanguageChange={handleLanguageChange} value={selectedLanguage} required />
        <RegionSelectorField
          disabled={!selectedLanguage}
          rootLanguage={selectedLanguage || ''}
          serviceCode={serviceCode}
          serviceType='transcription'
          onRegionChange={handleRegionChange}
          onCancel={handleCancelLanguage}
          mt={REQUIRED_ASTERISK_OFFSET}
        />
      </Group>

      <Group justify='flex-end' mt='md'>
        <ButtonNew onClick={props.onRequestClose} variant='light'>
          {t('Cancel')}
        </ButtonNew>
        <ButtonNew onClick={handleStartTranscription} disabled={!selectedLanguage}>
          {t('Start Transcription')}
        </ButtonNew>
      </Group>
    </Stack>
  )
}
