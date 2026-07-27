import { modals } from '@mantine/modals'
import { getAssetDisplayName } from '#/assetUtils'
import ClampedTitle from '#/components/common/ClampedTitle'
import SharingForm from '#/components/permissions/sharingForm.component'
import type { AssetResponse, ProjectViewAsset } from '#/dataInterface'

interface OpenSharingModalOptions {
  asset: AssetResponse | ProjectViewAsset
}

/** Opens sharing permissions in a Mantine modal. */
export function openSharingModal(options: OpenSharingModalOptions) {
  const assetName = getAssetDisplayName(options.asset).final

  const modalId = modals.open({
    title: (
      <ClampedTitle>{t('Sharing Permissions: ##project name##').replace('##project name##', assetName)}</ClampedTitle>
    ),
    size: 'lg',
    // Mantine listens for Escape on `window`, so a confirmation modal opened on top of this one would close both. We
    // handle Escape inside `SharingForm` instead — nested modals render in their own portal, so their Escape presses
    // never reach it.
    closeOnEscape: false,
    children: <SharingForm assetUid={options.asset.uid} onRequestClose={() => modals.close(modalId)} />,
  })

  return {
    modalId,
    close: () => modals.close(modalId),
  }
}
