import { useDebouncedValue } from '@mantine/hooks'
import { useMemo, useState } from 'react'
import { useLanguagesList } from '#/api/react-query/other'
import Select from './Select'

interface LanguageSelectorNewProps {
  // TODO: Fix the typing here, the new orval types are incompatible with old types being used in the single processing view
  onLanguageChange: Function
}

const MINIMUM_SEARCH_LENGTH = 2
// Timeout chosen based on same debounce time in old languageSelector.tsx
const SEARCH_DEBOUNCE_MS = 300

const LanguageSelectorNew = (props: LanguageSelectorNewProps) => {
  const [searchValue, setSearchValue] = useState('')
  const [debouncedSearch] = useDebouncedValue(searchValue, SEARCH_DEBOUNCE_MS)
  const isSearching = debouncedSearch.length >= MINIMUM_SEARCH_LENGTH

  const { data, isLoading } = useLanguagesList(
    isSearching ? ({ q: debouncedSearch } as any) : undefined,
  )

  const languages = data?.status === 200 ? data.data.results : []
  const languageOptions = useMemo(() => {
    const languagesList = isSearching ? languages : languages.filter((lang) => lang.featured)
    return languagesList.map((lang) => ({
      value: lang.code,
      label: `${lang.name} (${lang.code})`,
    }))
  }, [data, isSearching])

  const onLanguageSelected = (selectedLanguage: string | null) => {
    const selectedLanguageObject = languages.find((lang) => lang.code === selectedLanguage) || null
    props.onLanguageChange(selectedLanguageObject)
  }

  return (
    <Select
      onSearchChange={setSearchValue}
      data={languageOptions}
      onChange={onLanguageSelected}
      label='Select language'
      searchable
      clearable
    />
  )
}

export default LanguageSelectorNew
