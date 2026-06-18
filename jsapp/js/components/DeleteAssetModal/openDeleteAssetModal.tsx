import { modals } from '@mantine/modals'
import { userCanDeleteAssets } from '#/assetUtils'
import { ASSET_TYPES } from '#/constants'
import type { AssetResponse, ProjectViewAsset } from '#/dataInterface'
import { generateUuid } from '#/utils'
import { DeleteAssetModal } from './DeleteAssetModal'
import { DeleteBlockerModal } from './DeleteBlockerModal'

export function openDeleteAssetModal(
  asset: AssetResponse | ProjectViewAsset,
  name: string,
  onDeleted?: (deletedAssetUid: string) => void,
) {
  const modalId = `delete-asset-${generateUuid()}`
  const deleteCheck = userCanDeleteAssets([asset])

  if (deleteCheck.canDelete) {
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
  } else {
    modals.open({
      modalId,
      title: t("This project can't be deleted"),
      size: 'md',
      children: (
        <DeleteBlockerModal assets={[asset]} reason={deleteCheck.reason} onRequestClose={() => modals.close(modalId)} />
      ),
    })
  }

  return {
    modalId,
    close: () => modals.close(modalId),
  }
}
