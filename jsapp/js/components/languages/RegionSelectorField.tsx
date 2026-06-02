import type { FlexProps } from '@mantine/core'
import { Box, Group, Loader, Text } from '@mantine/core'
import { IconInfoCircleFilled } from '@tabler/icons-react'
import { KOBO_Z_INDEX } from '#/theme/kobo/zIndex'
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
  titleOverride?: string
}

/** Dropdown only region selector for automated transcriptions */
const RegionSelectorField = (props: RegionSelectorProps) => {
  const { rootLanguage, serviceCode, serviceType, onRegionChange, titleOverride, disabled, ...flexProps } = props
  const { regionOptions, selectedRegion, handleRegionChange, isLoading, isError } = useRegionOptions(
    props.rootLanguage,
    props.serviceCode,
    props.serviceType,
    props.onRegionChange,
  )

  if (isError) {
    return (
      <Text c='var(--mantine-color-red-5)' size='sm' mb={props?.mb}>
        {t('Failed to load regions')}
      </Text>
    )
  }

  return (
    <Box {...flexProps}>
      <Select
        label={props.titleOverride ?? t('Select a region')}
        data={regionOptions}
        value={selectedRegion}
        onChange={handleRegionChange}
        disabled={props.disabled}
        placeholder={t('Select a region...')}
        // Needed so the dropdown doesn't appear behind mantine modals
        comboboxProps={{ zIndex: KOBO_Z_INDEX.dropdown }}
        rightSection={isLoading ? <Loader size='xs' /> : undefined}
        nothingFoundMessage={
          isLoading ? undefined : (
            <Group gap={'xs'} align='center' style={{ cursor: 'pointer' }} c='var(--mantine-color-blue-5)'>
              <KoboIcon icon={IconInfoCircleFilled} size='sm' />
              <Text>{t('No language regions available')}</Text>
            </Group>
          )
        }
      />
    </Box>
  )
}

export default RegionSelectorField
