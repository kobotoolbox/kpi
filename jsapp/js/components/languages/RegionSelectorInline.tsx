import type { FlexProps } from '@mantine/core'
import { ActionIcon, Flex, Group, Loader, Text, TextInput } from '@mantine/core'
import { IconLanguage, IconX } from '@tabler/icons-react'
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

/** Dropdown + language display region selector for automated transcriptions */
const RegionSelectorInline = ({
  rootLanguage,
  serviceCode,
  serviceType,
  onRegionChange,
  onCancel,
  disabled,
  ...flexProps
}: RegionSelectorProps) => {
  const { regionOptions, selectedRegion, handleRegionChange, isLoading, isError, language } = useRegionOptions(
    rootLanguage,
    serviceCode,
    serviceType,
    onRegionChange,
  )

  if (isLoading) {
    return <Loader size='xs' mb={flexProps.mb} />
  }

  if (isError) {
    return (
      <Text c='var(--mantine-color-red-5)' size='sm' mb={flexProps.mb}>
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
            <ActionIcon aria-label={t('Close')} variant='transparent' size='sm' onClick={onCancel} disabled={disabled}>
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
            disabled={disabled}
            placeholder={t('Select a region...')}
          />
        )}
      </Group>
    </Flex>
  )
}

export default RegionSelectorInline
