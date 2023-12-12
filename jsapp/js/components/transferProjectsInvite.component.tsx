import React, {useState, useEffect} from 'react';
import KoboModal from 'js/components/modals/koboModal';
import KoboModalHeader from 'js/components/modals/koboModalHeader';
import KoboModalFooter from 'js/components/modals/koboModalFooter';
import Button from 'js/components/common/button';
import Icon from 'js/components/common/icon';

import styles from './transferProjects.module.scss';

export default function TransferProjectsInvite() {
  const [isModalOpen, setIsModalOpen] = useState(true);
  const [isDeclined, setIsDeclined] = useState(false);

  const toggleModal = () => {
    setIsModalOpen(!isModalOpen);
  };

  return (
    <KoboModal isOpen={isModalOpen} onRequestClose={toggleModal} size='medium'>
      <KoboModalHeader>
        {isDeclined
          ? t('Project transfer declined')
          : 'Accept ownership transfer'}
      </KoboModalHeader>
      {!isDeclined && (
        <div>
          <section className={styles.modalBody}>
            <p className={styles.modalCopy}>
              {t(
                'When you accept the ownership transfer of project {project name}, all of the submissions, data storage, and transcription and translation usage for the project will be transferred to you and count against your plan limits.'
              )}
              <br />
              <br />
              <strong>
                {t(
                  'Once you accept, the transfer might take a few minutes to complete.'
                )}
              </strong>
            </p>

            <div className={styles.warning}>
              <Icon
                name='information'
                size='s'
                color='red'
                classNames={[styles.warningIcon]}
              />

              <div className={styles.warningCopy}>
                {t(
                  'Note: The previous owner has permissions to manage the project. You can change user permissions in the project sharing settings.'
                )}
              </div>
            </div>
          </section>

          <KoboModalFooter alignment='end'>
            <Button
              label={t('Decline')}
              onClick={() => setIsDeclined(true)}
              color='blue'
              type='frame'
              size='l'
            />
            <Button
              label={t('Accept')}
              onClick={() => {
                console.log('TODO');
              }}
              color='blue'
              type='full'
              size='l'
            />
          </KoboModalFooter>
        </div>
      )}

      {isDeclined && (
        <section className={styles.modalBody}>
          <p className={styles.modalCopy}>
            {t(
              'You have declined the request of transfer ownership for {project name}.'
            )}
          </p>

          <div className={styles.warning}>
            <Icon
              name='information'
              size='s'
              color='red'
              classNames={[styles.warningIcon]}
            />

            <div className={styles.warningCopy}>
              {t(
                '{current owner name} will receive a notification that the transfer was incomplete. {current owner name} will remain the project owner.'
              )}
            </div>
          </div>
        </section>
      )}
    </KoboModal>
  );
}
