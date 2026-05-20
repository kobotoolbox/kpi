import { ActionIcon, Flex, Group, Select, TextInput } from '@mantine/core'
import { IconLanguage, IconX } from '@tabler/icons-react'
import { useMemo } from 'react'
import { useLanguagesRetrieve } from '#/api/react-query/other'
import KoboIcon from '../common/KoboIcon'
import type { LanguageBase, LanguageCode, TransxServiceCode } from './languagesStore'

// FIXME: Temporarily moved these type definitions here to remove the languagesStore.ts until DEV-2143 is done
interface DetailedLanguageRegion {
  code: LanguageCode
  name: string
}

interface DetailedLanguageServices {
  [serviceCode: TransxServiceCode]: { [languageCode: LanguageCode]: LanguageCode }
}

interface DetailedLanguage extends LanguageBase {
  /**
   * A list of regions for given language with their unique language codes,
   * e.g. "Canada", "Belgium", "France", and "Switzerland" for French (fr).
   */
  regions: DetailedLanguageRegion[]
  /**
   * A list of available transcription services for given language with a map of
   * "ours to theirs" language codes.
   */
  transcription_services: DetailedLanguageServices
  /**
   * A list of available translation services for given language with a map of
   * "ours to theirs" language codes.
   */
  translation_services: DetailedLanguageServices
}

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
    <Flex component='section' direction='row' align='center' justify='center'>
      <Group gap='xs'>
        <TextInput
          readOnly
          value={language?.name}
          size='sm'
          leftSection={<KoboIcon icon={IconLanguage} size='sm' />}
          w={220}
          rightSection={
            <ActionIcon variant='transparent' size='sm' onClick={props.onCancel} disabled={props.isDisabled}>
              <KoboIcon icon={IconX} size='xs' />
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
    </Flex>
  )
}

export default RegionSelectorNew
