import { useMemo, useState } from 'react'
import { useLanguagesList } from '#/api/react-query/other'
import Autocomplete from './Autocomplete'

const LanguageSelectorNew = () => {
  const [recentSelections, setRecentSelections] = useState<string[]>([])
  const [value, setValue] = useState('')

  // In your component:
  const { data, isLoading } = useLanguagesList()

  const languageOptions = data?.status === 200 ? data.data.results.map((lang) => `${lang.name} (${lang.code})`) : []

  // Group data: recent first, then all others
  const groupedData = useMemo(() => {
    const recent = recentSelections.filter((item) => languageOptions.includes(item))
    const others = languageOptions.filter((item) => !recent.includes(item))

    const groups = []
    if (recent.length > 0) {
      groups.push({ group: 'Recently selected', items: recent })
    }
    groups.push({ group: 'All options', items: others })

    return groups
  }, [recentSelections, languageOptions])

  const handleChange = (newValue: string) => {
    setValue(newValue)

    // Add to recent selections (max 5, most recent first)
    if (newValue) {
      setRecentSelections((prev) => {
        const filtered = prev.filter((item) => item !== newValue)
        return [newValue, ...filtered].slice(0, 5)
      })
    }
  }

  return <Autocomplete data={groupedData} value={value} onChange={handleChange} label='Select language' />
}

export default LanguageSelectorNew
