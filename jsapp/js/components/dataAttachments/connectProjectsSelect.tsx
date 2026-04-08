import Select from 'react-select'
import bem from '#/bem'
import type { AssetResponse, AssetsResponse } from '#/dataInterface'

interface ConnectProjectsSelectProps {
  sharingEnabledAssets: AssetsResponse | null
  filteredAssets: AssetResponse[]
  value: AssetResponse | null
  isLoading: boolean
  isInitialised: boolean
  sourceError?: string
  onSourceChange: (newVal: AssetResponse | null) => void
}

export default function ConnectProjectsSelect({
  sharingEnabledAssets,
  filteredAssets,
  value,
  isLoading,
  isInitialised,
  sourceError,
  onSourceChange,
}: ConnectProjectsSelectProps) {
  if (sharingEnabledAssets === null) {
    return null
  }

  return (
    <bem.KoboSelect__wrapper
      m={{
        error: Boolean(sourceError),
      }}
    >
      <Select<AssetResponse, false>
        placeholder={t('Select a different project to import data from')}
        options={filteredAssets}
        value={value}
        isLoading={!isInitialised || isLoading}
        getOptionLabel={(option) => option.name}
        getOptionValue={(option) => option.url}
        noOptionsMessage={() => t('No projects to connect')}
        onChange={onSourceChange}
        className='kobo-select'
        classNamePrefix='kobo-select'
      />

      {sourceError && <bem.KoboSelect__error>{sourceError}</bem.KoboSelect__error>}
    </bem.KoboSelect__wrapper>
  )
}
