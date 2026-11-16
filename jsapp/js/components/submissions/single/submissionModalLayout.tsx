import { Group } from '@mantine/core'
import React from 'react'
import Button from '#/components/common/ButtonNew'
import ModalNew from '#/components/common/ModalNew'

interface SubmissionModalLayoutProps {
  title: React.ReactNode
  onClose: () => void
  /** Previous/Next, if the modal can step between records. */
  navigation?: React.ReactNode
  /** Leaves for the record's own address. Leave it out until there is a record to open. */
  onOpenFullRecord?: () => void
  children: React.ReactNode
}

/** The frame of a submission record shown in a modal, over the screen it was opened from. */
export default function SubmissionModalLayout({
  title,
  onClose,
  navigation,
  onOpenFullRecord,
  children,
}: SubmissionModalLayoutProps) {
  return (
    <ModalNew opened onClose={onClose} title={title} size={1240}>
      {(navigation || onOpenFullRecord) && (
        <Group justify='flex-end' gap='xs' mb='md'>
          {navigation}

          {onOpenFullRecord && (
            <Button variant='light' size='md' rightIcon='angle-right' onClick={onOpenFullRecord}>
              {t('Open full record')}
            </Button>
          )}
        </Group>
      )}

      {children}
    </ModalNew>
  )
}
