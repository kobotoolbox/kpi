import { Tooltip } from '@mantine/core'
import { IconPencilStar } from '@tabler/icons-react'
import KoboIcon from '#/components/common/KoboIcon'
import Menu from '#/components/common/Menu'
import { goToProcessing } from '#/components/processing/routes.utils'

interface MenuItemProcessingProps {
  assetUid: string
  xpath: string
  submissionEditId: string
  /** Disables the item, showing this as its tooltip. */
  disabledReason?: string
}

/** A "Translate & analyze" menu item, opening Processing for the given question. */
export default function MenuItemProcessing({
  assetUid,
  xpath,
  submissionEditId,
  disabledReason,
}: MenuItemProcessingProps) {
  const isDisabled = disabledReason !== undefined

  return (
    <Tooltip label={disabledReason} disabled={!isDisabled}>
      {/* `data-disabled` rather than `disabled`, as a disabled item gets no hover, and so no tooltip. */}
      <Menu.Item
        leftSection={<KoboIcon icon={IconPencilStar} size={16} />}
        data-disabled={isDisabled || undefined}
        aria-disabled={isDisabled || undefined}
        closeMenuOnClick={!isDisabled}
        onClick={isDisabled ? undefined : () => goToProcessing(assetUid, xpath, submissionEditId)}
      >
        {t('Translate & analyze')}
      </Menu.Item>
    </Tooltip>
  )
}
