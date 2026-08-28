import { modals } from '@mantine/modals'
import LibraryNewItemForm from './LibraryNewItemForm'

export function openLibraryNewItemModal() {
  const modalId = modals.open({
    title: t('Create Library Item'),
    size: 'lg',
    children: (
      <LibraryNewItemForm />
    ),
  })

  return { modalId, close }
}
