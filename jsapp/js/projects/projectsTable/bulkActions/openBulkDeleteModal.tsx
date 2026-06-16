import { modals } from '@mantine/modals'
import type { AssetResponse, ProjectViewAsset } from '#/dataInterface'
import { generateUuid } from '#/utils'
import { BulkDeleteBlockerModal, BulkDeleteModal } from './BulkDeleteModal'

/**
 * Opens the bulk delete confirmation modal, or a blocker if any of the
 * selected projects cannot be deleted (submissions or permissions issue).
 * The caller is responsible for determining `blockerReason`.
 */
export function openBulkDeleteModal(
  assets: Array<AssetResponse | ProjectViewAsset>,
  { blockerReason }: { blockerReason?: 'submissions' | 'permissions' } = {},
) {
  const assetUids = assets.map((asset) => asset.uid)
  const isSingle = assets.length === 1
  const modalId = `bulk-delete-${generateUuid()}`

  if (blockerReason) {
    const title = isSingle ? t("This project can't be deleted") : t("Some of these projects can't be deleted")

    modals.open({
      modalId,
      title,
      size: 'md',
      children: (
        <BulkDeleteBlockerModal assets={assets} reason={blockerReason} onRequestClose={() => modals.close(modalId)} />
      ),
    })
  } else {
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
  }

  return {
    modalId,
    close: () => modals.close(modalId),
  }
}
