import type { ComponentType, ReactNode } from 'react'

import type { ModalProps } from '@mantine/core'
import { Group, Stack } from '@mantine/core'
import type { IconProps as SvgIconProps, TablerIcon } from '@tabler/icons-react'
import ButtonNew from '#/components/common/ButtonNew'
import ModalNew from '#/components/common/ModalNew'
import type { IconName } from '#/k-icons'

export interface ProcessingPromptModalProps extends Omit<ModalProps, 'title'> {
  /** Rendered as-is, so callers can combine an icon with the title text. */
  title: ReactNode
  /** Main content of the dialog, e.g. a media preview relevant to the question type. */
  children: ReactNode
  actionLabel: string
  actionIcon?: IconName | TablerIcon | ComponentType<SvgIconProps>
  onAction: () => void
}

/**
 * Generic dialog used to invite the user to send a submission response into
 * the Processing flow (e.g. to transcribe, translate, or otherwise analyze
 * it). The body content is provided by the caller since it depends on the
 * question type (audio, text, etc.), which lets this dialog be reused for
 * question types other than audio in the future.
 */
export default function ProcessingPromptModal(props: ProcessingPromptModalProps) {
  const { title, children, actionLabel, actionIcon, onAction, ...modalProps } = props

  return (
    <ModalNew title={title} size='md' {...modalProps}>
      <Stack>
        {children}

        <Group justify='flex-end'>
          <ButtonNew size='md' rightIcon={actionIcon} onClick={onAction}>
            {actionLabel}
          </ButtonNew>
        </Group>
      </Stack>
    </ModalNew>
  )
}
