import { modals } from '@mantine/modals'
import { ASSET_TYPES, type AssetTypeName } from '#/constants'
import type { AssetResponse } from '#/dataInterface'
import { LibraryAssetForm } from './LibraryAssetForm'

export interface OpenLibraryAssetModalArgs {
  asset?: AssetResponse
  assetType?: AssetTypeName
  /** When given, the form gets a "Back" button that closes this modal and calls it. */
  onBack?: () => void
}

/** Opens the create/edit form of a library asset (template or collection) in a Mantine modal. */
export function openLibraryAssetModal({ asset, assetType, onBack }: OpenLibraryAssetModalArgs = {}) {
  const type = asset?.asset_type ?? assetType
  const close = () => modals.close(modalId)

  const modalId = modals.open({
    title: type === ASSET_TYPES.collection.id ? t('Collection details') : t('Template details'),
    size: 'lg',
    children: (
      <LibraryAssetForm
        asset={asset}
        assetType={assetType}
        onBack={
          onBack &&
          (() => {
            close()
            onBack()
          })
        }
        onRequestClose={close}
      />
    ),
  })

  return { modalId, close }
}
