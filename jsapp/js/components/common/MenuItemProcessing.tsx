import { Tooltip } from '@mantine/core'
import { IconPencilStar } from '@tabler/icons-react'
import KoboIcon from '#/components/common/KoboIcon'
import Menu from '#/components/common/Menu'
import { getRepeatGroupProcessingUnavailableMessage } from '#/components/processing/common/constants'
import { goToProcessing } from '#/components/processing/routes.utils'

interface MenuItemProcessingProps {
  assetUid: string
  xpath: string
  submissionEditId: string
  /** Processing doesn't support answers inside a repeat group, so the item is disabled, explaining why. */
  isInRepeatGroup?: boolean
}

/** A "Translate & analyze" menu item, opening Processing for the given question. */
export default function MenuItemProcessing({
  assetUid,
  xpath,
  submissionEditId,
  isInRepeatGroup,
}: MenuItemProcessingProps) {
  if (isInRepeatGroup) {
    return (
      <Tooltip label={getRepeatGroupProcessingUnavailableMessage()}>
        {/* `data-disabled` rather than `disabled`, as a disabled item gets no hover, and so no tooltip. */}
        <Menu.Item
          leftSection={<KoboIcon icon={IconPencilStar} size={16} />}
          data-disabled
          aria-disabled
          closeMenuOnClick={false}
        >
          {t('Translate & analyze')}
        </Menu.Item>
      </Tooltip>
    )
  }

  return (
    <Menu.Item
      leftSection={<KoboIcon icon={IconPencilStar} size={16} />}
      onClick={() => goToProcessing(assetUid, xpath, submissionEditId)}
    >
      {t('Translate & analyze')}
    </Menu.Item>
  )
}
