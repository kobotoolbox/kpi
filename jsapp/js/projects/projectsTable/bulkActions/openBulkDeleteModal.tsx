import { modals } from '@mantine/modals'
import { userCanDeleteAssets } from '#/assetUtils'
import { DeleteBlockerModal } from '#/components/DeleteAssetModal/DeleteBlockerModal'
import type { AssetResponse, ProjectViewAsset } from '#/dataInterface'
import { generateUuid } from '#/utils'
import { BulkDeleteModal } from './BulkDeleteModal'

/**
 * Opens the bulk delete confirmation modal, or a blocker if any of the
 * selected projects cannot be deleted (submissions or permissions issue).
 * Permission checks are computed internally — callers just pass the assets.
 */
export function openBulkDeleteModal(assets: Array<AssetResponse | ProjectViewAsset>) {
  const assetUids = assets.map((asset) => asset.uid)
  const isSingle = assets.length === 1
  const modalId = `bulk-delete-${generateUuid()}`
  const deleteCheck = userCanDeleteAssets(assets)

  if (deleteCheck.canDelete) {
    const title = isSingle
      ? t('Delete 1 project')
      : t('Delete ##count## projects').replace('##count##', String(assetUids.length))

    modals.open({
      modalId,
      title,
      size: 'md',
      children: (
        <BulkDeleteModal assetUids={assetUids} modalId={modalId} onRequestClose={() => modals.close(modalId)} />
      ),
    })
  } else {
    const title = isSingle ? t("This project can't be deleted") : t("Some of these projects can't be deleted")

    modals.open({
      modalId,
      title,
      size: 'md',
      children: (
        <DeleteBlockerModal
          assets={assets}
          blockedAssets={deleteCheck.blockedAssets}
          reason={deleteCheck.reason}
          onRequestClose={() => modals.close(modalId)}
        />
      ),
    })
  }

  return {
    modalId,
    close: () => modals.close(modalId),
  }
}
