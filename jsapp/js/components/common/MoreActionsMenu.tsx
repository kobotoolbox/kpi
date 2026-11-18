import { Menu } from '@mantine/core'
import type { ReactNode } from 'react'
import ActionIcon from '#/components/common/ActionIcon'

interface MoreActionsMenuProps {
  children?: ReactNode
  className?: string
}

/** A "…" button that opens a dropdown menu of actions. */
export default function MoreActionsMenu({ children, className }: MoreActionsMenuProps) {
  return (
    <Menu withinPortal={false} closeOnClickOutside closeOnItemClick position='bottom-end'>
      <Menu.Target>
        <span className={className} style={{ position: 'relative' }}>
          <ActionIcon size='md' variant='transparent' iconName='more' />
        </span>
      </Menu.Target>

      <Menu.Dropdown>{children}</Menu.Dropdown>
    </Menu>
  )
}
