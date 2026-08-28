import { Stack } from '@mantine/core'
import { IconFolderFilled, IconLibrary, IconTemplate, IconUpload } from '@tabler/icons-react'
import { useNavigate } from 'react-router-dom'
import bem from '#/bem'
import LoadingSpinner from '#/components/common/loadingSpinner'
import { openLibraryUploadModal } from '#/components/library/LibraryUploadModal'
import managedCollectionsStore from '#/components/library/managedCollectionsStore'
import { openLibraryAssetModal } from '#/components/modalForms/openLibraryAssetModal'
import { ASSET_TYPES, } from '#/constants'
import { ROUTES } from '#/router/routerConstants'
import { getRouteAssetUid, isAnyLibraryItemRoute } from '#/router/routerUtils'
import { useSession } from '#/stores/useSession'
import KoboIcon from '../common/KoboIcon'
import {openLibraryNewItemModal} from './openLibraryNewItemModal'

export default function LibraryNewItemForm() {
  const session = useSession()
  const navigate = useNavigate()

  function goToAssetCreator() {
    let targetPath: string = ROUTES.NEW_LIBRARY_ITEM
    const assetUid = getRouteAssetUid()
    if (isAnyLibraryItemRoute() && assetUid) {
      const found = managedCollectionsStore.find(assetUid)
      if (found && found.asset_type === ASSET_TYPES.collection.id) {
        // when creating from within a collection page, make the new asset
        // a child of this collection
        targetPath = ROUTES.NEW_LIBRARY_CHILD.replace(':uid', found.uid)
      }
    }

    navigate(targetPath)
  }

  function goToCollection() {
    openLibraryAssetModal({
      assetType: ASSET_TYPES.collection.id,
      onBack: openLibraryNewItemModal,
    })
  }

  function goToTemplate() {
    openLibraryAssetModal({
      assetType: ASSET_TYPES.template.id,
      onBack: openLibraryNewItemModal,
    })
  }

  function goToUpload() {
    openLibraryUploadModal({ onBack: openLibraryNewItemModal })
  }

  if (!session.currentLoggedAccount) {
    return <LoadingSpinner />
  }

  return (
    <bem.FormModal__form className='project-settings project-settings--form-source'>
      <bem.FormModal__item m='form-source-buttons'>
        <button onClick={goToAssetCreator}>
          <Stack gap={5} align='center'>
            <KoboIcon icon={IconLibrary} size='xl' color='var(--mantine-color-gray-2)' />
            {t('Question Block')}
          </Stack>
        </button>

        <button onClick={goToTemplate}>
          <Stack gap={5} align='center'>
            <KoboIcon icon={IconTemplate} size='xl' color='var(--mantine-color-gray-2)' />
            {t('Template')}
          </Stack>
        </button>

        <button onClick={goToUpload}>
          <Stack gap={5} align='center'>
            <KoboIcon icon={IconUpload} size='xl' color='var(--mantine-color-gray-2)' />
            {t('Upload')}
          </Stack>
        </button>

        <button onClick={goToCollection}>
          <Stack gap={5} align='center'>
            <KoboIcon icon={IconFolderFilled} size='xl' color='var(--mantine-color-gray-2)' />
            {t('Collection')}
          </Stack>
        </button>
      </bem.FormModal__item>
    </bem.FormModal__form>
  )
}
