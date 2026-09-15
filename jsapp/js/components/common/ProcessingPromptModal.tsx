import type { ReactNode } from 'react'

import type { ModalProps } from '@mantine/core'
import { Group, Stack } from '@mantine/core'
import { IconPencilStar } from '@tabler/icons-react'
import ButtonNew from '#/components/common/ButtonNew'
import KoboIcon from '#/components/common/KoboIcon'
import ModalNew from '#/components/common/ModalNew'

export interface ProcessingPromptModalProps extends Omit<ModalProps, 'title'> {
  /** Rendered as-is, so callers can combine an icon with the title text. */
  title: ReactNode
  /** Main content of the dialog, e.g. a media preview relevant to the question type. */
  children: ReactNode
  /** Omit to hide the action button, e.g. when Processing isn't reachable for this response. */
  onAction?: () => void
}

/**
 * Generic dialog used to invite the user to send a submission response into
 * the Processing flow (e.g. to transcribe, translate, or otherwise analyze
 * it). The body content is provided by the caller since it depends on the
 * question type (audio, text, etc.), which lets this dialog be reused for
 * question types other than audio in the future.
 */
export default function ProcessingPromptModal(props: ProcessingPromptModalProps) {
  const { title, children, onAction, ...modalProps } = props

  return (
    <ModalNew title={title} size='md' {...modalProps}>
      <Stack>
        {children}

        {onAction && (
          <Group justify='flex-end'>
            <ButtonNew size='md' leftSection={<KoboIcon icon={IconPencilStar} size={16} />} onClick={onAction}>
              {t('Translate & analyze')}
            </ButtonNew>
          </Group>
        )}
      </Stack>
    </ModalNew>
  )
}
