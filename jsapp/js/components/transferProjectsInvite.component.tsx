import React, {useState, useEffect} from 'react';
import KoboModal from 'js/components/modals/koboModal';
import KoboModalHeader from 'js/components/modals/koboModalHeader';
import KoboModalFooter from 'js/components/modals/koboModalFooter';
import Button from 'js/components/common/button';
import Icon from 'js/components/common/icon';

import styles from './transferProjectsInvite.module.scss';

export default function TransferProjectsInvite() {
  const [isModalOpen, setIsModalOpen] = useState(true);
  const [isDeclined, setIsDeclined] = useState(false);

  const toggleModal = () => {
    setIsModalOpen(!isModalOpen);
  };

  let noteClass = styles.note;
  if (isDeclined) {
    noteClass = [noteClass, styles.declinedNote].join(' ');
  }

  return (
    <KoboModal isOpen={isModalOpen} onRequestClose={toggleModal} size='medium'>
      <KoboModalHeader onRequestCloseByX={toggleModal} headerColor='white'>
        {isDeclined
          ? t('Project transfer declined')
          : 'Accept ownership transfer'}
      </KoboModalHeader>
      <div>
        <section className={styles.modalBody}>
          {isDeclined ? (
            <p>
              {t(
                'You have declined the request of transfer ownership for {project name}.'
              )}
            </p>
          ) : (
            <p>
              {t(
                'When you accept the ownership transfer of project {project name}, all of the submissions, data storage, and transcription and translation usage for the project will be transferred to you and count against your plan limits.'
              )}
            </p>
          )}

          {!isDeclined && (
            <strong>
              {t(
                'Once you accept, the transfer might take a few minutes to complete.'
              )}
            </strong>
          )}
          <div className={noteClass}>
            <Icon
              name='information'
              size='s'
              color='blue'
              classNames={[styles.noteIcon]}
            />
            {isDeclined ? (
              <div>
                {t(
                  '{current owner name} will receive a notification that the transfer was incomplete. {current owner name} will remain the project owner.'
                )}
              </div>
            ) : (
              <div>
                {t(
                  'Note: The previous owner has permissions to manage the project. You can change user permissions in the project sharing settings.'
                )}
              </div>
            )}
          </div>
        </section>

        {!isDeclined && (
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
                console.log('someting yet');
              }}
              color='blue'
              type='full'
              size='l'
            />
          </KoboModalFooter>
        )}
      </div>
    </KoboModal>
  );
}
