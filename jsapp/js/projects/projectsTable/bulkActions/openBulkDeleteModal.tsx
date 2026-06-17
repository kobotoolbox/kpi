import { modals } from '@mantine/modals'
import { MemberRoleEnum } from '#/api/models/memberRoleEnum'
import { queryClient } from '#/api/queryClient'
import {
  type OrganizationsRetrieveQueryResult,
  getOrganizationsRetrieveQueryKey,
} from '#/api/react-query/user-team-organization-usage'
import { DeleteBlockerModal } from '#/components/DeleteAssetModal/DeleteBlockerModal'
import { userCan } from '#/components/permissions/utils'
import type { AssetResponse, ProjectViewAsset } from '#/dataInterface'
import sessionStore from '#/stores/session'
import { generateUuid } from '#/utils'
import { BulkDeleteModal } from './BulkDeleteModal'

function getDeleteBlockerReason(
  assets: Array<AssetResponse | ProjectViewAsset>,
): 'submissions' | 'permissions' | undefined {
  const account = sessionStore.currentAccount
  const orgUid = 'organization' in account ? account.organization?.uid : undefined
  const orgResponse = orgUid
    ? queryClient.getQueryData<OrganizationsRetrieveQueryResult>(getOrganizationsRetrieveQueryKey(orgUid))
    : undefined
  const org = orgResponse?.status === 200 ? orgResponse.data : undefined

  const isAdmin = org?.request_user_role === MemberRoleEnum.admin
  if (isAdmin) {
    return undefined
  }

  const isMmoMember = org?.is_mmo && org?.request_user_role === MemberRoleEnum.member
  const currentUsername = account.username

  if (isMmoMember) {
    if (assets.some((asset) => (asset.deployment__submission_count ?? 0) > 0)) {
      return 'submissions'
    }
    if (
      assets.some(
        (asset) => !asset.created_by || asset.created_by !== currentUsername || !userCan('manage_asset', asset),
      )
    ) {
      return 'permissions'
    }
  }

  // Non-MMO users: button is disabled unless they can delete all assets,
  // so no blocker is needed — return undefined and open the confirmation modal.
  return undefined
}

/**
 * Opens the bulk delete confirmation modal, or a blocker if any of the
 * selected projects cannot be deleted (submissions or permissions issue).
 * Permission checks are computed internally — callers just pass the assets.
 */
export function openBulkDeleteModal(assets: Array<AssetResponse | ProjectViewAsset>) {
  const assetUids = assets.map((asset) => asset.uid)
  const isSingle = assets.length === 1
  const modalId = `bulk-delete-${generateUuid()}`
  const blockerReason = getDeleteBlockerReason(assets)

  if (blockerReason) {
    const title = isSingle ? t("This project can't be deleted") : t("Some of these projects can't be deleted")

    modals.open({
      modalId,
      title,
      size: 'md',
      children: (
        <DeleteBlockerModal assets={assets} reason={blockerReason} onRequestClose={() => modals.close(modalId)} />
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
