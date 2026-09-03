import { modals } from '@mantine/modals'
import LibraryNewItemForm from './LibraryNewItemForm'

/** Opens the "Create Library Item" source picker in a Mantine modal. */
export function openLibraryNewItemModal() {
  const close = () => modals.close(modalId)

  const modalId = modals.open({
    title: t('Create Library Item'),
    size: 'lg',
    children: <LibraryNewItemForm onRequestClose={close} reopenHomeModal={openLibraryNewItemModal} />,
  })

  return { modalId, close }
}
