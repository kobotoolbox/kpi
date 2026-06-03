import { useEffect, useMemo, useRef, useState } from 'react'
import { getLanguagesRetrieveQueryKey, useLanguagesRetrieve } from '#/api/react-query/other'
import type { LanguageCode, TransxServiceCode } from './languagesStore'

export function useRegionOptions(
  rootLanguage: LanguageCode,
  serviceCode: TransxServiceCode,
  serviceType: 'transcription' | 'translation',
  onRegionChange: (selectedRegion: LanguageCode | null) => void,
) {
  const { data, isLoading, isError } = useLanguagesRetrieve(rootLanguage, {
    query: {
      queryKey: getLanguagesRetrieveQueryKey(rootLanguage),
      enabled: rootLanguage !== '',
    },
  })
  const language = data?.status === 200 ? data.data : undefined
  const [selectedRegion, setSelectedRegion] = useState<LanguageCode | null>(null)

  const onRegionChangeRef = useRef(onRegionChange)
  useEffect(() => {
    onRegionChangeRef.current = onRegionChange
  }, [onRegionChange])

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
      onRegionChangeRef.current?.(initialOption)
    } else {
      setSelectedRegion(null)
      onRegionChangeRef.current?.(null)
    }
  }, [regionOptions])

  const handleRegionChange = (newRegion: string | null) => {
    setSelectedRegion(newRegion)
    onRegionChangeRef.current?.(newRegion)
  }
  return { regionOptions, selectedRegion, handleRegionChange, isLoading, isError, language }
}
