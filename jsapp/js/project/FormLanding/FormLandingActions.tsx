import { Link } from 'react-router-dom'
import ActionIcon from '#/components/common/ActionIcon'
import KoboMenu from '#/components/common/Menu'
import { openKoboConfirmModal } from '#/components/common/openKoboConfirmModal'
import { openEnketoPreviewModal } from '#/components/enketoPreview/openEnketoPreviewModal'
import { openSharingModal } from '#/components/permissions/openSharingModal'
import { ASSET_TYPES } from '#/constants'
import type { AssetResponse } from '#/dataInterface'
import { openReplaceProjectModal } from '#/project/ProjectSettings/openReplaceProjectModal'

interface FormLandingActionsProps {
  asset: AssetResponse
  canEdit: boolean
  isLoggedIn: boolean
  canRemoveSharedProject: boolean
  onRemoveSharedProject: () => void
  onClone: (assetType: string) => void
}

export default function FormLandingActions({
  asset,
  canEdit,
  isLoggedIn,
  canRemoveSharedProject,
  onRemoveSharedProject,
  onClone,
}: FormLandingActionsProps) {
  const onRemoveSharedProjectClick = () => {
    openKoboConfirmModal({
      title: t('Remove shared form'),
      children: t('Are you sure you want to remove this shared form?'),
      labels: { confirm: t('Remove'), cancel: t('Cancel') },
      onConfirm: onRemoveSharedProject,
    })
  }

  return (
    <>
      {canEdit ? (
        <ActionIcon
          component={Link}
          to={`/forms/${asset.uid}/edit`}
          variant='transparent'
          size='md'
          iconName='edit'
          tooltip={t('Edit in Form Builder')}
          aria-label={t('Edit in Form Builder')}
        />
      ) : (
        <ActionIcon
          variant='transparent'
          size='md'
          iconName='edit'
          tooltip={t('Editing capabilities not granted, you can only view this form')}
          aria-label={t('Edit in Form Builder')}
          disabled
        />
      )}

      <ActionIcon
        variant='transparent'
        size='md'
        iconName='view'
        tooltip={t('Preview')}
        aria-label={t('Preview')}
        onClick={() => asset.url && openEnketoPreviewModal({ assetUrl: asset.url })}
        disabled={!asset.url}
      />

      {canEdit && (
        <ActionIcon
          variant='transparent'
          size='md'
          iconName='replace'
          tooltip={t('Replace form')}
          aria-label={t('Replace form')}
          onClick={() => openReplaceProjectModal({ asset })}
        />
      )}

      <KoboMenu>
        <KoboMenu.Target>
          <span>
            <ActionIcon
              variant='transparent'
              size='md'
              iconName='more'
              tooltip={t('More actions')}
              aria-label={t('More actions')}
            />
          </span>
        </KoboMenu.Target>
        <KoboMenu.Dropdown>
          {(asset.downloads || []).map((download) => (
            <KoboMenu.Item
              component='a'
              href={download.url}
              key={`dl-${download.format}`}
              leftSection={<i className={`k-icon k-icon-file-${download.format}`} />}
            >
              {t('Download')}&nbsp;
              {download.format.toUpperCase()}
            </KoboMenu.Item>
          ))}

          {canEdit && (
            <KoboMenu.Item
              onClick={() => openSharingModal({ asset })}
              leftSection={<i className='k-icon k-icon-user-share' />}
            >
              {t('Share this project')}
            </KoboMenu.Item>
          )}

          {isLoggedIn && canRemoveSharedProject && (
            <KoboMenu.Item onClick={onRemoveSharedProjectClick} leftSection={<i className='k-icon k-icon-trash' />}>
              {t('Remove shared project')}
            </KoboMenu.Item>
          )}

          {isLoggedIn && (
            <KoboMenu.Item
              onClick={() => onClone(ASSET_TYPES.survey.id)}
              leftSection={<i className='k-icon k-icon-duplicate' />}
            >
              {t('Clone this project')}
            </KoboMenu.Item>
          )}

          {isLoggedIn && (
            <KoboMenu.Item
              onClick={() => onClone(ASSET_TYPES.template.id)}
              leftSection={<i className='k-icon k-icon-template' />}
            >
              {t('Create template')}
            </KoboMenu.Item>
          )}
        </KoboMenu.Dropdown>
      </KoboMenu>
    </>
  )
}
