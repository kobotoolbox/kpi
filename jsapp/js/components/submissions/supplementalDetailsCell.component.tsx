import React, {useState} from 'react';
import styles from './supplementalDetailsCell.module.scss';
import Button from 'js/components/common/button';
import KoboModal from 'js/components/modals/koboModal';
import KoboModalHeader from 'js/components/modals/koboModalHeader';
import {getSupplementalDetailsContent} from 'js/components/submissions/submissionUtils';
import type {SubmissionResponse} from 'js/dataInterface';

interface SupplementalDetailsCellProps {
  responseData: SubmissionResponse;
  /** With groups e.g. group_person/group_pets/group_pet/pet_name. */
  targetKey: string;
}

export default function SupplementalDetailsCell(
  props: SupplementalDetailsCellProps
) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const content = getSupplementalDetailsContent(
    props.responseData,
    props.targetKey,
  );

  if (content === null) {
    return (
      <span className={styles.cell}>
        {t('N/A')}
      </span>
    );
  }

  return (
    <>
      <span className={styles.cell}>
        {content}

        <Button
          type='bare'
          color='light-blue'
          size='s'
          startIcon='expand-arrow'
          onClick={() => setIsModalOpen(true)}
        />
      </span>

      <KoboModal
        isOpen={isModalOpen}
        onRequestClose={() => setIsModalOpen(false)}
        isDismissableByDefaultMeans
      >
        <KoboModalHeader
          onRequestCloseByX={() => setIsModalOpen(false)}
        >
          {'xxx'}
        </KoboModalHeader>

        <section className={styles.modalContent}>
          {content}
        </section>
      </KoboModal>
    </>
  );
}
