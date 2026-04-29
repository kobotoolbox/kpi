import { useMemo, useState } from 'react'
import { useLanguagesList } from '#/api/react-query/other'
import Autocomplete from './Autocomplete'

const LanguageSelectorNew = () => {
  const [value, setValue] = useState('')
  const [recentSelections, setRecentSelections] = useState<string[]>([])

  const { data, isLoading } = useLanguagesList()
  const languageOptions = data?.status === 200 ? data.data.results.map((lang) => `${lang.name} (${lang.code})`) : []

  const groupedData = useMemo(() => {
    const recent = recentSelections.filter((item) => languageOptions.includes(item))
    const others = languageOptions.filter((item) => !recent.includes(item))

    const groups = []
    // TODO: remove the 'title' of the groups
    if (recent.length > 0) {
      groups.push({ group: 'Recent', items: recent })
    }
    groups.push({ group: 'Others', items: others })

    return groups
  }, [recentSelections, languageOptions])

  const handleChange = (newValue: string) => {
    setValue(newValue)

    if (newValue) {
      setRecentSelections((prev) => {
        const filtered = prev.filter((item) => item !== newValue)
        return [newValue, ...filtered]
      })
    }
  }

  return <Autocomplete data={groupedData} value={value} onChange={handleChange} label='Select language' />
}

export default LanguageSelectorNew
