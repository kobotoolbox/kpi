import type { FlexProps } from '@mantine/core'
import { ActionIcon, Alert, Flex, Group, Loader, Select, Text, TextInput } from '@mantine/core'
import { IconLanguage, IconX } from '@tabler/icons-react'
import { useEffect, useMemo, useState } from 'react'
import { useLanguagesRetrieve } from '#/api/react-query/other'
import KoboIcon from '../common/KoboIcon'
import type { LanguageCode, TransxServiceCode } from './languagesStore'

interface RegionSelectorProps extends Omit<FlexProps, 'onChange'> {
  disabled?: boolean
  /** The root language code of a language that possibly has regions. */
  rootLanguage: LanguageCode
  /** We display regions only from selected provider of given type. */
  serviceCode: TransxServiceCode
  serviceType: 'transcription' | 'translation'
  /** Callback for a region is being selected. */
  onRegionChange: (selectedRegion: LanguageCode | null) => void
  /** Callback for clicking "x" next to the root language. */
  onCancel: () => void
}

const RegionSelector = (props: RegionSelectorProps) => {
  const { data, isLoading, isError } = useLanguagesRetrieve(props.rootLanguage)
  const language = data?.status === 200 ? data.data : undefined
  const [selectedRegion, setSelectedRegion] = useState<LanguageCode | null>(null)

  const regionOptions = useMemo(() => {
    const outcome = []
    let serviceRegions
    if (props.serviceType === 'transcription') {
      serviceRegions = language?.transcription_services[props.serviceCode]
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

    // We return the options sorted by their labels.
    return outcome.sort((a, b) => {
      const labelA = a.label.toLowerCase() // ignore upper and lowercase
      const labelB = b.label.toLowerCase() // ignore upper and lowercase
      if (labelA < labelB) {
        return -1
      }
      if (labelA > labelB) {
        return 1
      }
      return 0 // happens when labels are equal (should not happen in real life)
    })
  }, [language, props.serviceCode, props.serviceType])

  // Needed to populate the Select value after getting data
  useEffect(() => {
    if (regionOptions.length > 0) {
      const initialOption = regionOptions[0].value
      setSelectedRegion(initialOption)
      props.onRegionChange?.(initialOption)
    } else {
      setSelectedRegion(null)
    }
  }, [regionOptions, props.onRegionChange])

  const handleRegionChange = (newRegion: string | null) => {
    setSelectedRegion(newRegion)
    props.onRegionChange(newRegion)
  }

  if (isLoading) {
    return <Loader size='xs' mb={props?.mb} />
  }

  if (isError) {
    return <Text c='var(--mantine-color-red-5)' size='sm' mb={props?.mb}>Failed to load regions</Text>
  }

  return (
    <Flex component='section' direction='row' align='center' justify='center' mb={props?.mb}>
      <Group gap='xs'>
        <TextInput
          readOnly
          value={language?.name || ''}
          size='sm'
          leftSection={<KoboIcon icon={IconLanguage} size='sm' />}
          w={220}
          rightSection={
            <ActionIcon
              aria-label={t('Close')}
              variant='transparent'
              size='sm'
              onClick={props.onCancel}
              disabled={props.disabled}
            >
              <KoboIcon icon={IconX} size='xs' />
            </ActionIcon>
          }
        />

        {regionOptions.length > 0 && (
          <Select
            w={220}
            data={regionOptions}
            value={selectedRegion}
            size='sm'
            onChange={handleRegionChange}
            disabled={props.disabled}
            placeholder={t('Select a region...')}
          />
        )}
      </Group>
    </Flex>
  )
}

export default RegionSelector
