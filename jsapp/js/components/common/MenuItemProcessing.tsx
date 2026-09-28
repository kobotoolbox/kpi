import { IconPencilStar } from '@tabler/icons-react'
import KoboIcon from '#/components/common/KoboIcon'
import Menu from '#/components/common/Menu'
import { goToProcessing } from '#/components/processing/routes.utils'

interface MenuItemProcessingProps {
  assetUid: string
  xpath: string
  submissionEditId: string
}

/** A "Translate & analyze" menu item, opening Processing for the given question. */
export default function MenuItemProcessing({ assetUid, xpath, submissionEditId }: MenuItemProcessingProps) {
  return (
    <Menu.Item
      leftSection={<KoboIcon icon={IconPencilStar} size={16} />}
      onClick={() => goToProcessing(assetUid, xpath, submissionEditId)}
    >
      {t('Translate & analyze')}
    </Menu.Item>
  )
}
