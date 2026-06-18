import {
  IconCheck,
  IconChevronLeft,
  IconFolderDown,
  IconFolderUp,
  IconTrashFilled,
  IconWorldFilled,
} from '@tabler/icons-react'
import React from 'react'
import assetUtils from '#/assetUtils'
import ButtonNew from '#/components/common/ButtonNew'
import KoboIcon from '#/components/common/KoboIcon'
import Menu from '#/components/common/Menu'
import Icon from '#/components/common/icon'
import { userCan } from '#/components/permissions/utils'
import { ASSET_TYPES } from '#/constants'
import type { AssetDownloads, AssetResponse } from '#/dataInterface'

interface AssetMoreActionsProps {
  asset: AssetResponse
  managedCollections: AssetResponse[]
  onEditLanguages: () => void
  onMoveToCollection: (collectionUrl: string | null) => void
  onDelete: () => void
}

/**
 * "More actions" dropdown menu for library assets (collections, templates, blocks, questions).
 * Provides actions like:
 * - Manage translations
 * - Download files
 * - Remove from/Move to collection
 * - Delete
 *
 * Note: This component is used in Library contexts only. Survey-specific actions
 * (deploy, replace form, archive, unarchive) are handled elsewhere in formLanding.
 */
export default function AssetMoreActions(props: AssetMoreActionsProps) {
  const assetType = props.asset.asset_type
  const userCanEdit = userCan('change_asset', props.asset)
  const userCanDelete = userCan('delete_submissions', props.asset)

  // Only non-collection assets have downloads
  let downloads: AssetDownloads = []
  if (assetType !== ASSET_TYPES.collection.id) {
    downloads = props.asset.downloads
  }

  // Don't render menu if user has no edit permissions and no downloads
  if (!userCanEdit && downloads.length === 0) {
    return null
  }

  // Only show collection management for templates and questions/blocks (not surveys or collections)
  const canManageCollections =
    userCanEdit && assetType !== ASSET_TYPES.survey.id && assetType !== ASSET_TYPES.collection.id

  return (
    <Menu position='bottom-start'>
      <Menu.Target>
        <ButtonNew variant='transparent' size='md' leftIcon='more' tooltip={t('More actions')} />
      </Menu.Target>

      <Menu.Dropdown>
        {/* Manage translations - available for all non-collection assets */}
        {userCanEdit && assetType !== ASSET_TYPES.collection.id && (
          <Menu.Item onClick={props.onEditLanguages} leftSection={<KoboIcon icon={IconWorldFilled} size='md' />}>
            {t('Manage translations')}
          </Menu.Item>
        )}

        {/* Download files */}
        {downloads.map((dl) => (
          <Menu.Item
            component='a'
            href={dl.url}
            key={`dl-${dl.format}`}
            leftSection={<Icon name={`file-${dl.format}` as any} size='m' />}
          >
            {t('Download')}&nbsp;{dl.format.toString().toUpperCase()}
          </Menu.Item>
        ))}

        {/* Remove from collection */}
        {canManageCollections && props.asset.parent !== null && (
          <Menu.Item onClick={() => props.onMoveToCollection(null)} leftSection={<KoboIcon icon={IconFolderDown} />}>
            {t('Remove from collection')}
          </Menu.Item>
        )}

        {/* Move to collection submenu */}
        {canManageCollections && props.managedCollections.length > 0 && (
          <Menu trigger='click-hover' position='left-start' offset={2}>
            <Menu.Target>
              <Menu.Item leftSection={<KoboIcon icon={IconChevronLeft} />}>{t('Move to')}</Menu.Item>
            </Menu.Target>
            <Menu.Dropdown mah={400} style={{ overflowY: 'auto' }}>
              {props.managedCollections.map((collection) => {
                const isAssetParent = collection.url === props.asset.parent
                const displayName = assetUtils.getAssetDisplayName(collection).final
                return (
                  <Menu.Item
                    onClick={() => props.onMoveToCollection(collection.url)}
                    key={collection.uid}
                    title={displayName}
                    leftSection={<KoboIcon icon={isAssetParent ? IconCheck : IconFolderUp} />}
                  >
                    {isAssetParent ? <strong>{displayName}</strong> : displayName}
                  </Menu.Item>
                )
              })}
            </Menu.Dropdown>
          </Menu>
        )}

        {/* Delete */}
        {userCanEdit && userCanDelete && (
          <Menu.Item onClick={props.onDelete} leftSection={<KoboIcon icon={IconTrashFilled} />} color='red'>
            {t('Delete')}
          </Menu.Item>
        )}
      </Menu.Dropdown>
    </Menu>
  )
}
