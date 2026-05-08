import { useDebouncedValue } from '@mantine/hooks'
import { useQueries } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { getLanguagesRetrieveQueryOptions, useLanguagesList } from '#/api/react-query/other'
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

  // "Main" language list (either featured languages or result of searching), unlike the suggested language list which
  // exists seperately from this
  const { data, isLoading } = useLanguagesList(isSearching ? ({ q: debouncedSearch } as any) : undefined)
  const languages = data?.status === 200 ? data.data.results : []

  // Create a query for each suggested language
  const hasSuggestedLanguages = props.suggestedLanguages && props.suggestedLanguages.length > 0
  const suggestedLanguageQueries = useQueries({
    queries: hasSuggestedLanguages
      ? props.suggestedLanguages!.map((code) => getLanguagesRetrieveQueryOptions(code))
      : [],
  })

  const suggestedLanguages = hasSuggestedLanguages
    ? suggestedLanguageQueries
        .filter((result) => result.isSuccess)
        .flatMap((result) => (result.data?.status === 200 ? [result.data.data] : []))
    : []

  // We memoize here for a slight performance improvement, but mainly it makes the logic to group the suggested and 'main'
  // languages easier to read
  const languageOptions = useMemo(() => {
    // Show all results of a search, if there is no search, show the featured languages again
    const languagesList = isSearching ? languages : languages.filter((lang) => lang.featured)
    const allLanguages = [
      ...suggestedLanguages,
      ...languagesList.filter((lang) => !suggestedLanguages.some((suggested) => suggested.code === lang.code)),
    ]

    // Create language groups
    const suggestedItems = allLanguages
      .filter((lang) => props.suggestedLanguages?.includes(lang.code))
      .filter((lang) => !props.hiddenLanguages?.includes(lang.code))
      .map((lang) => ({
        value: lang.code,
        label: `${lang.name} (${lang.code})`,
      }))
    const otherItems = allLanguages
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
      group: isSearching ? t('Results') : t('Languages'),
      items: otherItems,
    })
    return groups
  }, [languages, isSearching, props.hiddenLanguages, props.suggestedLanguages, suggestedLanguages])

  const onLanguageSelected = (selectedLanguage: string | null) => {
    // Find in combined list (including fetched suggested languages)
    const allLanguages = [...suggestedLanguages, ...languages]
    const selectedLanguageObject = allLanguages.find((lang) => lang.code === selectedLanguage) || null
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
      comboboxProps={{ resetSelectionOnOptionHover: true }}
    />
  )
}

export default LanguageSelectorNew
