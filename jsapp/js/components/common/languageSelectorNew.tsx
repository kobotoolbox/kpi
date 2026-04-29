import { useMemo, useState } from 'react'
import { getLanguagesListQueryKey, languagesList, useLanguagesList } from '#/api/react-query/other'
import Autocomplete from './Autocomplete'
import {useInfiniteQuery} from '@tanstack/react-query'

const LanguageSelectorNew = () => {
  // TODO: how do we want to implement recently selected?
  //const [recentSelections, setRecentSelections] = useState<string[]>([])
  //const groupedData = useMemo(() => {
  //  const recent = recentSelections.filter((item) => languageOptions.includes(item))
  //  const others = languageOptions.filter((item) => !recent.includes(item))

  //  const groups = []
  //  if (recent.length > 0) {
  //    groups.push({ group: 'Recently selected', items: recent })
  //  }
  //  groups.push({ group: 'All options', items: others })

  //  return groups
  //}, [recentSelections, languageOptions])

  //const handleChange = (newValue: string) => {
  //  setValue(newValue)

  //  // Add to recent selections (max 5, most recent first)
  //  if (newValue) {
  //    setRecentSelections((prev) => {
  //      const filtered = prev.filter((item) => item !== newValue)
  //      return [newValue, ...filtered].slice(0, 5)
  //    })
  //  }
  //}

  const [value, setValue] = useState('')

  // In your component:
  const { data, isLoading } = useLanguagesList()
  const ITEMS_PER_PAGE = 100

  const languageOptions = data?.status === 200 ? data.data.results.map((lang) => `${lang.name} (${lang.code})`) : []


  const query = useInfiniteQuery({
    queryKey: [...getLanguagesListQueryKey(), ITEMS_PER_PAGE, 'infinite'],
    queryFn: ({ pageParam, signal }) =>
      languagesList({ limit: ITEMS_PER_PAGE, start: pageParam }, { signal }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.status === 200 && lastPage.data.next) {
        return allPages.length * ITEMS_PER_PAGE
      }
      return undefined
    },
  })

  console.log('---------------', query.data)

  //TODO: Scrolling?
  return <Autocomplete data={languageOptions} value={value} onChange={setValue} label='Select language' />
}

export default LanguageSelectorNew
