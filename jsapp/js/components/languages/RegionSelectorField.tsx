import type { FlexProps } from '@mantine/core'
import { Box, Group, Loader, Text } from '@mantine/core'
import { KOBO_Z_INDEX } from '#/theme/kobo/zIndex'
import Select from '../common/Select'
import type { LanguageCode, TransxServiceCode } from './languagesStore'
import { useRegionOptions } from './useRegionOptions'
import KoboIcon from '../common/KoboIcon'
import {IconInfoCircleFilled} from '@tabler/icons-react'

interface RegionSelectorProps extends Omit<FlexProps, 'onChange'> {
  disabled?: boolean
  /** The root language code of a language that possibly has regions. */
  rootLanguage: LanguageCode
  /** We display regions only from selected provider of given type. */
  serviceCode: TransxServiceCode
  serviceType: 'transcription' | 'translation'
  /** Callback for a region is being selected. */
  onRegionChange: (selectedRegion: LanguageCode | null) => void
  /** The region selector in the single processing view has an additonal text box to the left of the Select */
  titleOverride?: string
}

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
        comboboxProps={{ zIndex: KOBO_Z_INDEX.dropdown }}
        // Select is incompatible with many FlexProps, so we can add props here on a use by basis, instead of making the
        // component crowded with MantineSpacing props
        mt={props?.mt}
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
