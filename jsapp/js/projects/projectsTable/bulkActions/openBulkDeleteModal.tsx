import { modals } from '@mantine/modals'
import type { AssetResponse, ProjectViewAsset } from '#/dataInterface'
import { generateUuid } from '#/utils'
import { BulkDeleteBlockerModal, BulkDeleteModal } from './BulkDeleteModal'

/**
 * Opens the bulk delete confirmation modal, or a blocker if any of the
 * selected projects still have submissions that must be removed first, or if
 * the user lacks delete permissions on some of the selected projects.
 */
export function openBulkDeleteModal(
  assets: Array<AssetResponse | ProjectViewAsset>,
  { hasPermissionIssue = false } = {},
) {
  const assetUids = assets.map((asset) => asset.uid)
  const hasSubmissionIssue = assets.some((asset) => (asset.deployment__submission_count ?? 0) > 0)

  const modalId = `bulk-delete-${generateUuid()}`

  if (hasPermissionIssue || hasSubmissionIssue) {
    modals.open({
      modalId,
      title: t("Some of these projects can't be deleted"),
      size: 'md',
      children: (
        <BulkDeleteBlockerModal
          reason={hasPermissionIssue ? 'permissions' : 'submissions'}
          onRequestClose={() => modals.close(modalId)}
        />
      ),
    })
  } else {
    modals.open({
      modalId,
      title: t('Delete ##count## projects').replace('##count##', String(assetUids.length)),
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
