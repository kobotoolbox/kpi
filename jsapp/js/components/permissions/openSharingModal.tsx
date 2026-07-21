import { modals } from '@mantine/modals'
import React from 'react'
import SharingForm from '#/components/permissions/sharingForm.component'

interface OpenSharingModalParams {
  assetUid?: string
  uid?: string
  assetid?: string
}

interface OpenSharingModalOptions {
  params?: OpenSharingModalParams
  assetUid?: string
}

const ASSET_UID_LOCATION_PATTERN = /\/(?:forms|library)\/([^/?#]+)/

function resolveAssetUid(options: OpenSharingModalOptions) {
  const explicitUid = options.assetUid ?? options.params?.uid ?? options.params?.assetid
  if (explicitUid) {
    return explicitUid
  }

  // Some legacy entry points keep the asset UID in the route.
  const routeSources = [window.location.hash, window.location.pathname]
  for (const routeSource of routeSources) {
    const match = routeSource.match(ASSET_UID_LOCATION_PATTERN)
    if (match?.[1]) {
      return match[1]
    }
  }

  return null
}

/** Opens sharing permissions in a Mantine modal. */
export function openSharingModal(options: OpenSharingModalOptions = {}) {
  const resolvedAssetUid = resolveAssetUid(options)
  if (!resolvedAssetUid) {
    console.error('Unable to open sharing modal: no asset UID available.')
    return null
  }

  let modalId = ''

  modalId = modals.open({
    title: t('Sharing Permissions'),
    size: 'lg',
    children: <SharingForm assetUid={resolvedAssetUid} />,
  })

  return {
    modalId,
    close: () => modals.close(modalId),
  }
}
