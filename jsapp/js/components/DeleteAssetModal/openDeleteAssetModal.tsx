import { modals } from '@mantine/modals'
import { MemberRoleEnum } from '#/api/models/memberRoleEnum'
import { queryClient } from '#/api/queryClient'
import {
  type OrganizationsRetrieveQueryResult,
  getOrganizationsRetrieveQueryKey,
} from '#/api/react-query/user-team-organization-usage'
import { userCan } from '#/components/permissions/utils'
import { ASSET_TYPES } from '#/constants'
import type { AssetResponse, ProjectViewAsset } from '#/dataInterface'
import sessionStore from '#/stores/session'
import { generateUuid } from '#/utils'
import { DeleteAssetModal } from './DeleteAssetModal'
import { DeleteBlockerModal } from './DeleteBlockerModal'

function getDeleteBlockerReason(asset: AssetResponse | ProjectViewAsset): 'submissions' | 'permissions' | undefined {
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
    if ((asset.deployment__submission_count ?? 0) > 0) {
      return 'submissions'
    }
    if (!asset.created_by || asset.created_by !== currentUsername || !userCan('manage_asset', asset)) {
      return 'permissions'
    }
  }

  // Non-MMO users: the delete button is disabled unless they have delete_asset,
  // so no blocker is needed — return undefined and open the confirmation modal.
  return undefined
}

export function openDeleteAssetModal(
  asset: AssetResponse | ProjectViewAsset,
  name: string,
  onDeleted?: (deletedAssetUid: string) => void,
) {
  const modalId = `delete-asset-${generateUuid()}`
  const blockerReason = getDeleteBlockerReason(asset)

  if (blockerReason) {
    modals.open({
      modalId,
      title: t("This project can't be deleted"),
      size: 'md',
      children: (
        <DeleteBlockerModal assets={[asset]} reason={blockerReason} onRequestClose={() => modals.close(modalId)} />
      ),
    })
  } else {
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
  }

  return {
    modalId,
    close: () => modals.close(modalId),
  }
}
