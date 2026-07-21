import React from 'react'
import Button from '#/components/common/button'
import { QUESTION_TYPES } from '#/constants'
import { openTableMediaPreviewModal } from './TableMediaPreview'
import styles from './TextModalCell.module.scss'

interface TextModalCellProps {
  /**
   * Text to be displayed in modal.
   * If empty string is passed, empty cell will be rendered and no modal.
   * If `null` is passed, "not available" will be rendered and no modal.
   */
  text: string | null
  columnName: string
  submissionIndex: number
  submissionTotal: number
  modalContent?: React.ReactNode
}

/**
 * Displays given text (with fallback to "not available") and a way to open it
 * in a modal - useful to read a long text in full.
 */
export default function TextModalCell(props: TextModalCellProps) {
  // If there is no actual content, render a compact fallback and skip modal logic.
  if (props.text === null || props.text === '') {
    const textToDisplay = props.text === null ? t('N/A') : ''

    return (
      <div className={styles.cell}>
        <span className={styles.textContent}>{textToDisplay}</span>
      </div>
    )
  }

  const displayValue = props.text

  return (
    <div className={styles.cell} dir='auto'>
      <span className={styles.textContent}>{props.text}</span>

      <Button
        type='text'
        size='s'
        startIcon='expand-arrow'
        onClick={() => {
          openTableMediaPreviewModal({
            questionType: QUESTION_TYPES.text.id,
            displayValue,
            columnName: props.columnName,
            submissionIndex: props.submissionIndex,
            submissionTotal: props.submissionTotal,
            modalContent: props.modalContent,
          })
        }}
        className={styles.modalOpener}
      />
    </div>
  )
}
