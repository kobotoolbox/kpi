import { Center } from '@mantine/core'
import type { CenterProps, ElementProps } from '@mantine/core'

interface DeletedAttachment extends CenterProps, ElementProps<'div', keyof CenterProps> {}

/**
 * Use this in a place that you would normally render attachment things (player,
 * image, etc.), but the attachment is deleted now. We have this silly component
 * so the things are consistent.
 */
export default function DeletedAttachment(props: DeletedAttachment) {
  return (
    // We include the `deletedAttachment` class name so it's easier to style
    // this for parent component.
    <Center className='deletedAttachment' c='gray.3' fz='md' fs='italic' {...props}>
      {t('Deleted')}
    </Center>
  )
}
