import { Center } from '@mantine/core'

/**
 * Use this in a place that you would normally render attachment things (player,
 * image, etc.), but the attachment is deleted now. We have this silly component
 * so the things are consistent.
 */
export default function DeletedAttachment() {
  return (
    // We include the `deletedAttachment` class name so it's easier to style
    // this for parent component.
    // TODO: get a better gray
    <Center className='deletedAttachment' c='gray' fz='md' fs='italic'>{t('Deleted')}</Center>
  )
}
