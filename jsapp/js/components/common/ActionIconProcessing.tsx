import { IconPencilStar } from '@tabler/icons-react'
import ActionIcon from '#/components/common/ActionIcon'
import { getRepeatGroupProcessingUnavailableMessage } from '#/components/processing/common/constants'

interface ActionIconProcessingProps {
  /** Opens Processing for the given question. Not needed when `isInRepeatGroup`, as it can't be clicked then. */
  onClick?: () => void
  /** Processing doesn't support answers inside a repeat group, so the button is disabled, explaining why. */
  isInRepeatGroup?: boolean
}

/** An "Open" icon button, opening Processing for the given question. */
export default function ActionIconProcessing({ onClick, isInRepeatGroup }: ActionIconProcessingProps) {
  return (
    <ActionIcon
      variant='transparent'
      tooltip={isInRepeatGroup ? getRepeatGroupProcessingUnavailableMessage() : t('Open')}
      icon={IconPencilStar}
      size='sm'
      // `data-disabled` rather than `disabled`, as a disabled button gets no hover, and so no tooltip.
      data-disabled={isInRepeatGroup || undefined}
      aria-disabled={isInRepeatGroup || undefined}
      onClick={isInRepeatGroup ? undefined : onClick}
    />
  )
}
