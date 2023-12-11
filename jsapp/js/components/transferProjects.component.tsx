import React, {useState} from 'react';
import classNames from 'classnames';
import Button from 'js/components/common/button';
import styles from './transferProjects.module.scss';
import KoboModal from './modals/koboModal';
import KoboModalHeader from './modals/koboModalHeader';
import KoboModalFooter from './modals/koboModalFooter';
import Icon from './common/icon';
import TextBox from './common/textBox';

export default function TransferProjects() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [username, setUsername] = useState('');

  const updateUsername = (newUsername: string) => {
    setUsername(newUsername);
  };

  const toggleModal = () => {
    setIsModalOpen(!isModalOpen);
  };

  return (
    <div className={styles.root}>
      <div className={styles.bar}>
        <div className={styles.description}>
          <strong>{t('Transfer project ownership')}</strong>

          <div className={styles.copy}>
            {t(
              'Transfer ownership of this project to another user. All submissions, data storage, and transcription and translation usage for this project will be transferred to the new project owner.'
            )}
            &nbsp;
            <a>{t('Learn more')}</a>
            &nbsp;
            {t('→')}
          </div>
        </div>

        <Button
          label={t('Transfer')}
          isFullWidth
          onClick={toggleModal}
          color='storm'
          type='frame'
          size='l'
        />
      </div>

      <KoboModal
        isOpen={isModalOpen}
        onRequestClose={toggleModal}
        size='medium'
      >
        <KoboModalHeader onRequestCloseByX={toggleModal}>
          {t('Transfer ownership')}
        </KoboModalHeader>
        <section className={styles.modalBody}>
          <p className={styles.modalCopy}>
            {t(
              'This action will transfer ownership of {project name} to another user.'
            )}
            <br />
            <br />
            {t(
              'When you transfer ownership of the project to another user, all of the submissions, data storage, and transcription and translation usage for the project will be transferred to the new project owner.'
            )}
            <br />
            <br />
            {t(
              'The new project owner will receive an email request to accept the transfer. You will be notified when the transfer is accepted or declined.'
            )}
          </p>

          <div className={styles.warning}>
            <Icon
              name='warning'
              size='s'
              color='red'
              classNames={[styles.warningIcon]}
            />

            <div className={styles.warningCopy}>
              {t(
                'You will be the owner of the project until the transfer is accepted.'
              )}
              <br />
              <strong>
                {t(
                  'Once the transfer is accepted, you will not be able to undo this action.'
                )}
              </strong>
              &nbsp;
              <a>{t('Learn more')}</a>
            </div>
          </div>

          <div className={styles.input}>
            <TextBox
              label={t(
                'To complete the transfer, enter the username of the new project owner'
              )}
              value={username}
              placeholder={t('Enter username here')}
              required
              onChange={updateUsername}
            />
          </div>
        </section>

        <KoboModalFooter alignment='end'>
          <Button
            label={t('Cancel')}
            onClick={toggleModal}
            color='blue'
            type='frame'
            size='m'
          />
          <Button
            label={t('Transfer project')}
            onClick={() => {
              console.log('TODO', username);
            }}
            color='blue'
            type='full'
            size='m'
          />
        </KoboModalFooter>
      </KoboModal>
    </div>
  );
}
