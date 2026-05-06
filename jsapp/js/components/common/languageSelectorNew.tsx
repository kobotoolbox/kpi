import { useDebouncedValue } from '@mantine/hooks'
import { useMemo, useState } from 'react'
import { useLanguagesList } from '#/api/react-query/other'
import type { LanguageCode } from '../languages/languagesStore'
import Select from './Select'

interface LanguageSelectorNewProps {
  // TODO: Fix the typing here, the new orval types are incompatible with old types being used in the single processing view
  onLanguageChange: Function
  titleOverride?: string
  /** The following props are from the old languageSelector, and is useful to maintain it's UX*/
  hiddenLanguages?: LanguageCode[]
  suggestedLanguages?: LanguageCode[]
  /** The currently selected language code, used for the UX of single processing view */
  value?: LanguageCode | null
  isDisabled?: boolean
}

const MINIMUM_SEARCH_LENGTH = 2
// Timeout chosen based on same debounce time in old languageSelector.tsx
const SEARCH_DEBOUNCE_MS = 300

const LanguageSelectorNew = (props: LanguageSelectorNewProps) => {
  const [searchValue, setSearchValue] = useState('')
  const [debouncedSearch] = useDebouncedValue(searchValue, SEARCH_DEBOUNCE_MS)
  const isSearching = debouncedSearch.length >= MINIMUM_SEARCH_LENGTH

  const { data, isLoading } = useLanguagesList(isSearching ? ({ q: debouncedSearch } as any) : undefined)

  const languages = data?.status === 200 ? data.data.results : []
  const languageOptions = useMemo(() => {
    // When searching, show all results; otherwise show only featured
    const languagesList = isSearching ? languages : languages.filter((lang) => lang.featured)

    // Separate languages into suggested and other
    const suggestedItems = languagesList
      .filter((lang) => props.suggestedLanguages?.includes(lang.code))
      .filter((lang) => !props.hiddenLanguages?.includes(lang.code))
      .map((lang) => ({
        value: lang.code,
        label: `${lang.name} (${lang.code})`,
      }))

    const otherItems = languagesList
      .filter((lang) => !props.suggestedLanguages?.includes(lang.code))
      .filter((lang) => !props.hiddenLanguages?.includes(lang.code))
      .map((lang) => ({
        value: lang.code,
        label: `${lang.name} (${lang.code})`,
      }))

    // Build groups conditionally
    const groups = []

    if (suggestedItems.length > 0) {
      groups.push({
        group: t('Suggested'),
        items: suggestedItems,
      })
    }

    groups.push({
      // TODO: Naming of these categories?
      group: isSearching ? t('Results') : t('Languages'),
      items: otherItems,
    })

    return groups
  }, [languages, isSearching, props.hiddenLanguages, props.suggestedLanguages])

  const onLanguageSelected = (selectedLanguage: string | null) => {
    const selectedLanguageObject = languages.find((lang) => lang.code === selectedLanguage) || null
    props.onLanguageChange(selectedLanguageObject)
  }

  return (
    <Select
      onSearchChange={setSearchValue}
      data={languageOptions}
      onChange={onLanguageSelected}
      value={props.value ?? null}
      label={props.titleOverride}
      searchable
      clearable
      disabled={props.isDisabled}
    />
  )
}

export default LanguageSelectorNew
