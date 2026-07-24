import Select from 'react-select'
import bem from '#/bem'
import type { ConnectableAsset } from './common'

interface ConnectProjectsSelectProps {
  sharingEnabledAssetsLoaded: boolean
  filteredAssets: ConnectableAsset[]
  value: ConnectableAsset | null
  isLoading: boolean
  isInitialised: boolean
  sourceError?: string
  onSourceChange: (newVal: ConnectableAsset | null) => void
}

export default function ConnectProjectsSelect({
  sharingEnabledAssetsLoaded,
  filteredAssets,
  value,
  isLoading,
  isInitialised,
  sourceError,
  onSourceChange,
}: ConnectProjectsSelectProps) {
  if (!sharingEnabledAssetsLoaded) {
    return null
  }

  return (
    <bem.KoboSelect__wrapper
      m={{
        error: Boolean(sourceError),
      }}
    >
      <Select<ConnectableAsset, false>
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
