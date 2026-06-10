import { modals } from '@mantine/modals'
import { ASSET_TYPES } from '#/constants'
import type { AssetResponse, ProjectViewAsset } from '#/dataInterface'
import { DeleteAssetModal } from './DeleteAssetModal'

export function openDeleteAssetModal(
  asset: AssetResponse | ProjectViewAsset,
  name: string,
  onDeleted?: (deletedAssetUid: string) => void,
) {
  let modalId = ''

  modalId = modals.open({
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
