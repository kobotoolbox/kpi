import { Loader } from '@mantine/core'
import Select from '#/components/common/Select'
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

  const isPending = !isInitialised || isLoading

  return (
    <Select
      className='connect-projects-select'
      placeholder={t('Select a different project to import data from')}
      // `Select` only works on strings, so we use asset urls as option values
      // and look the whole asset up again when one gets selected.
      data={filteredAssets.map((asset) => ({ value: asset.url, label: asset.name }))}
      value={value?.url ?? null}
      onChange={(newValue) => {
        onSourceChange(filteredAssets.find((asset) => asset.url === newValue) ?? null)
      }}
      rightSection={isPending ? <Loader size='xs' /> : undefined}
      nothingFoundMessage={t('No projects to connect')}
      error={sourceError}
    />
  )
}
