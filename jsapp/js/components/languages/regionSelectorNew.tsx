import { ActionIcon, Group, Select, TextInput } from '@mantine/core'
import { useMemo } from 'react'
import { useLanguagesRetrieve } from '#/api/react-query/other'
import KoboIcon from '../common/KoboIcon'
import type { DetailedLanguage, LanguageCode, TransxServiceCode } from './languagesStore'

interface RegionSelectorProps {
  isDisabled?: boolean
  /** The root language code of a language that possibly has regions. */
  rootLanguage: LanguageCode
  /** We display regions only from selected provider of given type. */
  serviceCode: TransxServiceCode
  serviceType: 'transcription' | 'translation'
  /** Callback for a region is being selected. */
  onRegionChange?: (selectedRegion: LanguageCode | null) => void
  /** Callback for clicking "x" next to the root language. */
  onCancel?: () => void
}

const RegionSelectorNew = (props: RegionSelectorProps) => {
  const { data, isLoading, error } = useLanguagesRetrieve(props.rootLanguage)
  const language = data?.status === 200 ? (data.data as unknown as DetailedLanguage) : undefined
  const regionOptions = useMemo(() => {
    const outcome = []
    let serviceRegions
    if (props.serviceType === 'transcription') {
      serviceRegions = language?.transcription_services[props.serviceCode]
      console.log('service2', language?.translation_services)
    } else if (props.serviceType === 'translation') {
      serviceRegions = language?.translation_services[props.serviceCode]
    }

    if (serviceRegions) {
      for (const ourLanguageCode in serviceRegions) {
        const serviceLanguageCode = serviceRegions[ourLanguageCode]
        const label = language?.regions.find((region) => region.code === ourLanguageCode)?.name

        if (serviceLanguageCode && label) {
          outcome.push({
            label: label,
            value: serviceLanguageCode,
          })
        }
      }
    }

    return outcome
  }, [props.serviceCode, props.serviceType])

  return (
    <Group gap='xs'>
      <TextInput
        readOnly
        value={language?.name}
        size='sm'
        leftSection={<KoboIcon name='language-alt' size='sm' />}
        w={220}
        rightSection={
          <ActionIcon variant='transparent' size='sm' onClick={props.onCancel} disabled={props.isDisabled}>
            <KoboIcon name='close' size='xs' />
          </ActionIcon>
        }
      />

      <Select
        w={220}
        data={regionOptions}
        size='sm'
        onChange={props.onRegionChange}
        disabled={props.isDisabled}
        placeholder={t('Select a region...')}
      />
    </Group>
  )
}

export default RegionSelectorNew
