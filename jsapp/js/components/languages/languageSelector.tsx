import { Group, Loader, Text } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { IconInfoCircleFilled } from '@tabler/icons-react'
import { useQueries } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { getLanguagesRetrieveQueryOptions, useLanguagesList } from '#/api/react-query/other'
import envStore from '#/envStore'
import KoboIcon from '../common/KoboIcon'
import Select from '../common/Select'
import type { LanguageCode } from '../languages/languagesStore'

interface LanguageSelectorProps {
  /**
   * TODO: This should be typed as (language: ListLanguage | null) => void but there's a type incompatibility
   * between what StepSelectLanguage expects and what the orval-generated API types are.
   * Specifically, `transcription_services` and `translation_services` arrays are readonly in new types.
   */
  onLanguageChange: (language: any) => void
  titleOverride?: string
  /** The following props are from the old languageSelector, and is useful to maintain it's UX*/
  hiddenLanguages?: LanguageCode[]
  suggestedLanguages?: LanguageCode[]
  /** The currently selected language code, used for the UX of single processing view */
  value?: LanguageCode | null
  isDisabled?: boolean
  required?: boolean
}

const MINIMUM_SEARCH_LENGTH = 2
// Timeout chosen based on same debounce time in old languageSelector.tsx
const SEARCH_DEBOUNCE_MS = 300
const LANGUAGE_SELECTOR_SUPPORT_URL = 'transcription-translation.html#language-list'

const LanguageSelector = (props: LanguageSelectorProps) => {
  const [searchValue, setSearchValue] = useState('')
  // TODO: if the recentlySelected language is not a featured language, it fails to show up on the group
  const [recentlySelected, setRecentlySelected] = useState<LanguageCode[]>([])
  const [debouncedSearch] = useDebouncedValue(searchValue, SEARCH_DEBOUNCE_MS)
  // Keep UI grouping in sync with what user is typing right now.
  // This avoids a stale "Results" group after clearing the input.
  const isSearching = searchValue.length >= MINIMUM_SEARCH_LENGTH
  // Keep API calls debounced to avoid network churn while typing.
  const isDebouncedSearching = debouncedSearch.length >= MINIMUM_SEARCH_LENGTH

  // "Main" language list (either featured languages or result of searching)
  const { data, isLoading } = useLanguagesList(isDebouncedSearching ? ({ q: debouncedSearch } as any) : undefined)
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
    const recentlySelectedItems = allLanguages
      .filter((lang) => recentlySelected.includes(lang.code))
      .map((lang) => {
        return {
          value: lang.code,
          label: `${lang.name} (${lang.code})`,
        }
      })
    const suggestedItems = allLanguages
      .filter((lang) => props.suggestedLanguages?.includes(lang.code))
      .filter((lang) => !props.hiddenLanguages?.includes(lang.code))
      .filter((lang) => !recentlySelected?.includes(lang.code))
      .map((lang) => {
        return {
          value: lang.code,
          label: `${lang.name} (${lang.code})`,
        }
      })
    const otherItems = allLanguages
      .filter((lang) => !props.suggestedLanguages?.includes(lang.code))
      .filter((lang) => !props.hiddenLanguages?.includes(lang.code))
      .filter((lang) => !recentlySelected?.includes(lang.code))
      .map((lang) => {
        return {
          value: lang.code,
          label: `${lang.name} (${lang.code})`,
        }
      })

    // Build groups conditionally
    const groups = []
    if (recentlySelectedItems.length > 0) {
      groups.push({
        group: t('Recently selected'),
        items: recentlySelectedItems,
      })
    }
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
  }, [languages, isSearching, props.hiddenLanguages, props.suggestedLanguages, suggestedLanguages, recentlySelected])

  const onLanguageSelected = (selectedLanguage: string | null) => {
    const allLanguages = [...suggestedLanguages, ...languages]
    const selectedLanguageObject = allLanguages.find((lang) => lang.code === selectedLanguage) || null
    if (selectedLanguageObject) {
      setRecentlySelected((prev) => [...prev, selectedLanguageObject.code])
    }
    props.onLanguageChange(selectedLanguageObject)
  }

  const openSupportPage = () => {
    window.open(envStore.data.support_url + LANGUAGE_SELECTOR_SUPPORT_URL, '_blank')
  }

  return (
    <Select
      searchValue={searchValue}
      onSearchChange={setSearchValue}
      data={languageOptions}
      onChange={onLanguageSelected}
      value={props.value ?? null}
      label={props.titleOverride}
      searchable
      clearable
      clearButtonProps={{
        // Mantine clear button is aria-hidden; give tests a stable selector.
        className: 'language-selector-clear-button',
        'aria-label': t('Clear selected language'),
      }}
      disabled={props.isDisabled}
      comboboxProps={{ resetSelectionOnOptionHover: true }}
      nothingFoundMessage={
        <Group
          onClick={openSupportPage}
          gap={'xs'}
          align='center'
          style={{ cursor: 'pointer' }}
          c='var(--mantine-color-blue-5)'
        >
          <KoboIcon icon={IconInfoCircleFilled} size='sm' />
          <Text>{t('I cannot find my language')}</Text>
        </Group>
      }
      renderOption={(option) => <Text>{option.option.label}</Text>}
      required={props.required}
      rightSection={isLoading ? <Loader size='xs' /> : undefined}
    />
  )
}

export default LanguageSelector
