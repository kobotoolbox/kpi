import React, {useState} from 'react';
import Button from 'js/components/common/button';
import styles from 'js/components/transferProjects.module.scss';
import KoboModal from 'js/components/modals/koboModal';
import KoboModalHeader from 'js/components/modals/koboModalHeader';
import KoboModalFooter from 'js/components/modals/koboModalFooter';
import Icon from 'js/components/common/icon';
import TextBox from 'js/components/common/textBox';
import {
  cancelInvite,
  sendInvite,
  TransferStatuses,
} from './transferProjects.api';
import type {AssetResponse} from 'js/dataInterface';

interface TransferProjectsProps {
  asset: AssetResponse;
}

interface TransferProjectsState {
  isModalOpen: boolean;
  username: string;
  usernameError: boolean | string;
  inviteStatus: TransferStatuses | null;
  inviteUrl: string | null;
}

const USERNAME_ERROR_MESSAGE = 'User not found. Please try again.';

export default function TransferProjects(props: TransferProjectsProps) {
  const [transfer, setTransfer] = useState<TransferProjectsState>({
    isModalOpen: false,
    username: '',
    usernameError: false,
    inviteStatus: props.asset.project_ownership
      ? props.asset.project_ownership.status
      : null,
    inviteUrl: props.asset.project_ownership
      ? props.asset.project_ownership.invite
      : null,
  });

  const updateUsername = (newUsername: string) => {
    setTransfer({...transfer, username: newUsername});
  };

  const toggleModal = () => {
    setTransfer({...transfer, isModalOpen: !transfer.isModalOpen});
  };

  function checkUsername(username: string) {
    if (username !== '') {
      setTransfer({...transfer, usernameError: false});
      sendInvite(username, props.asset.uid).then((data) => {
        setTransfer({
          ...transfer,
          inviteStatus: data.status,
          inviteUrl: data.url,
          isModalOpen: !transfer.isModalOpen,
        });
      });
    } else {
      setTransfer({...transfer, usernameError: USERNAME_ERROR_MESSAGE});
    }
  }

  function cancelCurrentInvite() {
    if (transfer.inviteUrl) {
      cancelInvite(transfer.inviteUrl).then((data) => {
        setTransfer({...transfer, inviteStatus: data.status});
      });
    } else {
      throw Error;
    }
  }

  function isStatusPending() {
    return transfer.inviteStatus === TransferStatuses.Pending;
  }

  return (
    <div className={styles.root}>
      <div className={styles.bar}>
        <div className={styles.description}>
          <strong>{t('Transfer project ownership')}</strong>
          <div className={styles.copy}>
            {isStatusPending() ? (
              <span>
                {t(
                  'Your transfer request is pending until jnm has accepted or declined it.'
                )}
              </span>
            ) : (
              <span>
                {t(
                  'Transfer ownership of this project to another user. All submissions, data storage, and transcription and translation usage for this project will be transferred to the new project owner.'
                )}
                &nbsp;
                <a>{t('Learn more')}</a>
                &nbsp;
                {t('→')}
              </span>
            )}
          </div>
        </div>

        <Button
          label={isStatusPending() ? t('Cancel transfer') : t('Transfer')}
          isFullWidth
          onClick={isStatusPending() ? cancelCurrentInvite : toggleModal}
          color='storm'
          type='frame'
          size='l'
        />
      </div>

      <KoboModal
        isOpen={transfer.isModalOpen}
        onRequestClose={toggleModal}
        size='medium'
      >
        <KoboModalHeader onRequestCloseByX={toggleModal} headerColor='white'>
          {t('Transfer ownership')}
        </KoboModalHeader>
        <section className={styles.modalBody}>
          <p>
            {t(
              'This action will transfer ownership of {project name} to another user.'
            )}
          </p>
          <p>
            {t(
              'When you transfer ownership of the project to another user, all of the submissions, data storage, and transcription and translation usage for the project will be transferred to the new project owner.'
            )}
          </p>
          <p>
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
              value={transfer.username}
              placeholder={t('Enter username here')}
              required
              errors={transfer.usernameError}
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
            onClick={() => checkUsername(transfer.username)}
            color='blue'
            type='full'
            size='m'
          />
        </KoboModalFooter>
      </KoboModal>
    </div>
  );
}
