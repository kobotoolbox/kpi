import { modals } from '@mantine/modals'
import { ASSET_TYPES } from '#/constants'
import type { AssetResponse, ProjectViewAsset } from '#/dataInterface'
import { generateUuid } from '#/utils'
import { DeleteAssetModal } from './DeleteAssetModal'

export function openDeleteAssetModal(
  asset: AssetResponse | ProjectViewAsset,
  name: string,
  onDeleted?: (deletedAssetUid: string) => void,
) {
  const modalId = `delete-asset-${generateUuid()}`

  modals.open({
    modalId,
    title: t('Delete ##ASSET_TYPE## "##NAME##"')
      .replace('##ASSET_TYPE##', ASSET_TYPES[asset.asset_type].label)
      .replace('##NAME##', name),
    size: 'md',
    children: (
      <DeleteAssetModal
        asset={asset}
        name={name}
        onDeleted={onDeleted}
        modalId={modalId}
        onRequestClose={() => modals.close(modalId)}
      />
    ),
  })

  return {
    modalId,
    close: () => modals.close(modalId),
  }
}
