import { Group, Stack, Text } from '@mantine/core'
import { useState } from 'react'
import ModalNew from '#/components/common/ModalNew'
import ButtonNew from '../common/ButtonNew'
import LanguageSelector from '../languages/LanguageSelector'
import RegionSelector from '../languages/RegionSelector'
import type { LanguageCode, TransxServiceCode } from '../languages/languagesStore'
import {modals} from '@mantine/modals'

interface BulkTranscriptionModalProps {
  fieldId: string
  selectedSubmissionIds: string[]
  selectedRowsCount: number
  selectedAllPages: boolean
  onRequestClose: () => void
}

type BulkTranscriptionModalArgs = Omit<BulkTranscriptionModalProps, 'onRequestClose'>

const REQUIRED_ASTERISK_OFFSET = 5

export function openBulkTranscriptModal(args: BulkTranscriptionModalArgs) {
  const modalId = modals.open({
    title: (
      t('Transcribe selected audio files')
    ),
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
  const [serviceCode] = useState<TransxServiceCode>('goog') // TODO: Get from user's settings or project configuration

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
    // TODO: Implement transcription logic with selectedLanguage and selectedRegion
    console.log('Starting transcription with:', { selectedLanguage, selectedRegion })
    props.onRequestClose()
  }

  return (
      <Stack gap='md'>
        <Text size='sm'>
          {t('Your 10 audio files is a total of 45 minutes. This should take less than 1 hour to complete.')}
        </Text>

        <Group gap='sm' align='flex-start' wrap='nowrap'>
          <LanguageSelector
            onLanguageChange={handleLanguageChange}
            value={selectedLanguage}
            required
          />
          <RegionSelector
            disabled={!selectedLanguage}
            rootLanguage={selectedLanguage || ''}
            serviceCode={serviceCode}
            serviceType='transcription'
            onRegionChange={handleRegionChange}
            onCancel={handleCancelLanguage}
            selectOnly
            mt={REQUIRED_ASTERISK_OFFSET}
          />
        </Group>

        <Group justify='flex-end' mt='md'>
          <ButtonNew onClick={props.onRequestClose} variant='light'>{t('Cancel')}</ButtonNew>
          <ButtonNew onClick={handleStartTranscription} disabled={!selectedLanguage}>
            {t('Start Transcription')}
          </ButtonNew>
        </Group>
      </Stack>
  )
}
