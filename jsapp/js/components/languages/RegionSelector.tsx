import type { FlexProps, MantineSize } from '@mantine/core'
import { Group, Loader, Text } from '@mantine/core'
import { IconInfoCircleFilled } from '@tabler/icons-react'
import { useEffect, useMemo, useState } from 'react'
import { getLanguagesRetrieveQueryKey, useLanguagesRetrieve } from '#/api/react-query/other'
import { KOBO_Z_INDEX } from '#/theme/kobo/zIndex'
import KoboIcon from '../common/KoboIcon'
import Select from '../common/Select'
import type { LanguageCode, TransxServiceCode } from './languagesStore'

interface RegionSelectorProps extends Omit<FlexProps, 'onChange'> {
  rootLanguage: LanguageCode
  disabled?: boolean
  /** We display regions only from selected provider of given type. */
  serviceCode: TransxServiceCode
  serviceType: 'transcription' | 'translation'
  /** Callback for a region is being selected. */
  onRegionChange: (selectedRegion: LanguageCode | null) => void
  titleOverride?: string
  size?: MantineSize
}

/** Dropdown only region selector for automated transcriptions */
const RegionSelector = ({
  rootLanguage,
  serviceCode,
  serviceType,
  onRegionChange,
  titleOverride,
  disabled,
  size,
}: RegionSelectorProps) => {
  const { data, isLoading, isError } = useLanguagesRetrieve(rootLanguage, {
    query: {
      // Same key as the RegionSelector hook
      queryKey: getLanguagesRetrieveQueryKey(rootLanguage),
      enabled: rootLanguage !== '',
    },
  })
  const language = data?.status === 200 ? data.data : undefined

  const [selectedRegion, setSelectedRegion] = useState<LanguageCode | null>(null)

  const regionOptions = useMemo(() => {
    const outcome = []
    let serviceRegions
    if (serviceType === 'transcription') {
      serviceRegions = language?.transcription_services[serviceCode]
    } else if (serviceType === 'translation') {
      serviceRegions = language?.translation_services[serviceCode]
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
      const labelA = a.label.toLowerCase()
      const labelB = b.label.toLowerCase()
      if (labelA < labelB) {
        return -1
      }
      if (labelA > labelB) {
        return 1
      }
      return 0 // happens when labels are equal (should not happen in real life)
    })
  }, [language, serviceCode, serviceType])

  // Needed to populate the Select value after getting data
  useEffect(() => {
    if (regionOptions.length > 0) {
      const initialOption = regionOptions[0].value
      setSelectedRegion(initialOption)
      onRegionChange(initialOption)
    } else {
      setSelectedRegion(null)
      onRegionChange(null)
    }
  }, [regionOptions])

  const handleRegionChange = (newRegion: string | null) => {
    setSelectedRegion(newRegion)
    onRegionChange(newRegion)
  }

  if (isError) {
    return (
      <Text c='var(--mantine-color-red-5)' size='sm'>
        {t('Failed to load regions')}
      </Text>
    )
  }

  return (
    <Select
      label={titleOverride ?? ''}
      data={regionOptions}
      value={selectedRegion}
      onChange={handleRegionChange}
      disabled={disabled}
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
      size={size}
    />
  )
}

export default RegionSelector
