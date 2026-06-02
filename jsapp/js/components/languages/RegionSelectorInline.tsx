import type { FlexProps } from '@mantine/core'
import { ActionIcon, Flex, Group, Loader, Text, TextInput } from '@mantine/core'
import { IconInfoCircleFilled, IconLanguage, IconX } from '@tabler/icons-react'
import KoboIcon from '../common/KoboIcon'
import Select from '../common/Select'
import type { LanguageCode, TransxServiceCode } from './languagesStore'
import { useRegionOptions } from './useRegionOptions'

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

const RegionSelectorInline = (props: RegionSelectorProps) => {
  const { rootLanguage, serviceCode, serviceType, onRegionChange, onCancel, disabled, ...flexProps } = props
  const { regionOptions, selectedRegion, handleRegionChange, isLoading, isError, language } = useRegionOptions(
    props.rootLanguage,
    props.serviceCode,
    props.serviceType,
    props.onRegionChange,
  )

  if (isLoading) {
    return <Loader size='xs' mb={props?.mb} />
  }

  if (isError) {
    return (
      <Text c='var(--mantine-color-red-5)' size='sm' mb={props?.mb}>
        {t('Failed to load regions')}
      </Text>
    )
  }

  return (
    <Flex component='section' direction='row' align='center' justify='center' {...flexProps}>
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

export default RegionSelectorInline
