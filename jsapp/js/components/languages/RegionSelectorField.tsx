import type { FlexProps } from '@mantine/core'
import { Loader, Text } from '@mantine/core'
import { KOBO_Z_INDEX } from '#/theme/kobo/zIndex'
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
  /** The region selector in the single processing view has an additonal text box to the left of the Select */
  titleOverride?: string
}

const RegionSelectorField = (props: RegionSelectorProps) => {
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
    <Select
      label={props.titleOverride ?? t('Select a region')}
      data={regionOptions}
      value={selectedRegion}
      onChange={handleRegionChange}
      disabled={props.disabled}
      placeholder={t('Select a region...')}
      comboboxProps={{ zIndex: KOBO_Z_INDEX.dropdown }}
      mt={props?.mt}
      rightSection={isLoading ? <Loader size='xs' /> : undefined}
    />
  )
}

export default RegionSelectorField
