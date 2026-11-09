import { IconPencilStar } from '@tabler/icons-react'
import ButtonNew from '#/components/common/ButtonNew'
import KoboIcon from '#/components/common/KoboIcon'

interface ProcessingActionButtonProps {
  /** Usually from `getProcessingActionLabel`, e.g. "Analyze image". */
  label: string
  onClick: () => void
}

/** The button that sends a submission response into Processing. */
export default function ProcessingActionButton(props: ProcessingActionButtonProps) {
  return (
    <ButtonNew size='md' leftSection={<KoboIcon icon={IconPencilStar} size={16} />} onClick={props.onClick}>
      {props.label}
    </ButtonNew>
  )
}
