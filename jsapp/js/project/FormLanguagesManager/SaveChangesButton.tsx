import React, { useEffect, useState } from 'react'

import ButtonNew from '#/components/common/ButtonNew'
import { SAVE_BUTTON_LABEL } from './types'

export type MarkDirtyRef = React.MutableRefObject<() => void>

interface SaveChangesButtonProps {
  saveButtonText: string
  isSavingTable: boolean
  onSave: () => void | Promise<void>
  markDirtyRef: MarkDirtyRef
}

/**
 * Renders the "Save Changes" button with an immediate "*" indicator the moment
 * the user starts editing a cell. Keeping this state local (and the markDirty
 * callback wired through a ref) means the table cells don't re-render when the
 * asterisk appears — which is what made the Mantine autosize Textarea drop
 * focus on the very first keystroke.
 */
export default function SaveChangesButton({
  saveButtonText,
  isSavingTable,
  onSave,
  markDirtyRef,
}: SaveChangesButtonProps) {
  const [isDirty, setIsDirty] = useState(false)

  useEffect(() => {
    markDirtyRef.current = () => setIsDirty(true)
    return () => {
      markDirtyRef.current = () => {}
    }
  }, [markDirtyRef])

  // Whenever the parent resets the canonical save button text (e.g. after a
  // successful save), drop the local dirty flag too so the asterisk goes away.
  useEffect(() => {
    if (saveButtonText === SAVE_BUTTON_LABEL.idle) {
      setIsDirty(false)
    }
  }, [saveButtonText])

  const displayText = isDirty && saveButtonText === SAVE_BUTTON_LABEL.idle ? SAVE_BUTTON_LABEL.dirty : saveButtonText

  return (
    <ButtonNew variant='filled' size='lg' onClick={onSave} disabled={isSavingTable}>
      {displayText}
    </ButtonNew>
  )
}
