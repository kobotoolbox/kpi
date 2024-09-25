import React, {useState} from 'react';
import styles from './textModalCell.module.scss';
import Button from 'js/components/common/button';
import KoboModal from 'js/components/modals/koboModal';
import KoboModalHeader from 'js/components/modals/koboModalHeader';
import KoboModalContent from 'js/components/modals/koboModalContent';

interface TextModalCellProps {
  /**
   * Text to be displayed in modal.
   * If empty string is passed, empty cell will be rendered and no modal.
   * If `null` is passed, "not available" will be rendered and no modal.
   */
  text: string | null;
  columnName: string;
  submissionIndex: number;
  submissionTotal: number;
}

/**
 * Displays given text (with fallback to "not available") and a way to open it
 * in a modal - useful to read a long text in full.
 */
export default function TextModalCell(
  props: TextModalCellProps
) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // If there is no actual content, we display sweet short "not availabe"
  // without all the modal code
  if (!props.text) {
    let textToDisplay = props.text;
    if (props.text === null) {
      textToDisplay = t('N/A');
    }

    return (
      <div className={styles.cell}>
        <span className={styles.textContent}>{textToDisplay}</span>
      </div>
    );
  }

  return (
    <>
      <div className={styles.cell} dir='auto'>
        <span className={styles.textContent}>{props.text}</span>

        <Button
          type='text'
          size='s'
          startIcon='expand-arrow'
          onClick={() => setIsModalOpen(true)}
          className={styles.modalOpener}
        />
      </div>

      <KoboModal
        isOpen={isModalOpen}
        onRequestClose={() => setIsModalOpen(false)}
        isDismissableByDefaultMeans
      >
        <KoboModalHeader onRequestCloseByX={() => setIsModalOpen(false)}>
          <div className={styles.modalHeaderText}>
            <span>
              {t('Submission ##submissionIndex## of ##submissionTotal##')
                .replace('##submissionIndex##', String(props.submissionIndex))
                .replace('##submissionTotal##', String(props.submissionTotal))}
            </span>

            <span dir='auto'>{props.columnName}</span>
          </div>
        </KoboModalHeader>

        <KoboModalContent>
          <div className={styles.modalContent} dir='auto'>{props.text}</div>
        </KoboModalContent>
      </KoboModal>
    </>
  );
}
