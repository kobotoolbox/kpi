import { useState } from 'react'
import ButtonNew from '#/components/common/ButtonNew'
import Menu from '#/components/common/Menu'
import ColumnsHideForm from '#/components/submissions/columnsHideForm'
import type { ColumnsHideFormProps } from '#/components/submissions/columnsHideForm'

/**
 * A dropdown to be used atop table to bulk hide columns.
 */
export default function ColumnsHideDropdown(props: ColumnsHideFormProps) {
  // The menu holds a form (not a list of actions), so we keep it open until the form itself tells us it's done.
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <Menu
      opened={isMenuOpen}
      onChange={setIsMenuOpen}
      closeOnItemClick={false}
      position='bottom-start'
      offset={2}
      // Focusing the first item would steal focus from the form's search box.
      withInitialFocusPlaceholder={false}
    >
      <Menu.Target>
        <ButtonNew variant='transparent' size='md' leftIcon='hide' mr='lg'>
          {t('Hide fields')}
        </ButtonNew>
      </Menu.Target>

      <Menu.Dropdown>
        <ColumnsHideForm {...props} onRequestClose={() => setIsMenuOpen(false)} />
      </Menu.Dropdown>
    </Menu>
  )
}
