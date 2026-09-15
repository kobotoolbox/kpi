import { Menu } from '@mantine/core'
import { IconPencilStar } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import ActionIcon from '#/components/common/ActionIcon'
import KoboIcon from '#/components/common/KoboIcon'
import { goToProcessing } from '#/components/processing/routes.utils'

interface MoreActionsMenuProps {
  children?: ReactNode
  className?: string
  processingAction?: {
    assetUid: string
    xpath: string
    submissionEditId: string
  }
}

/** A "…" button that opens a dropdown menu of actions. */
export default function MoreActionsMenu({ children, className, processingAction }: MoreActionsMenuProps) {
  return (
    <Menu withinPortal={false} closeOnClickOutside closeOnItemClick position='bottom-end'>
      <Menu.Target>
        <span className={className} style={{ position: 'relative' }}>
          <ActionIcon size='md' variant='transparent' iconName='more' />
        </span>
      </Menu.Target>

      <Menu.Dropdown>
        {processingAction && (
          <>
            <Menu.Item
              leftSection={<KoboIcon icon={IconPencilStar} size={16} />}
              onClick={() =>
                goToProcessing(processingAction.assetUid, processingAction.xpath, processingAction.submissionEditId)
              }
            >
              {t('Translate & analyze')}
            </Menu.Item>
            {children && <Menu.Divider />}
          </>
        )}

        {children}
      </Menu.Dropdown>
    </Menu>
  )
}
