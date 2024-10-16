import React, {useState} from 'react';
import Button from 'js/components/common/button';
import KoboModal from 'js/components/modals/koboModal';
import KoboModalHeader from 'js/components/modals/koboModalHeader';
import KoboModalFooter from 'js/components/modals/koboModalFooter';
import TextBox from 'js/components/common/textBox';
import InlineMessage from 'js/components/common/inlineMessage';
import {
  cancelInvite,
  sendInvite,
  TransferStatuses,
} from './transferProjects.api';
import type {AssetResponse} from 'js/dataInterface';
import sessionStore from 'js/stores/session';
import envStore from 'js/envStore';
import {HELP_ARTICLE_ANON_SUBMISSIONS_URL} from 'js/constants';

import styles from './transferProjects.module.scss';

interface TransferProjectsProps {
  asset: AssetResponse;
}

interface TransferProjectsState {
  isModalOpen: boolean;
  invitedUserName: string | null;
  usernameInput: string;
  usernameError: boolean | string;
  inviteStatus: TransferStatuses | null;
  inviteUrl: string | null;
  submitPending: boolean;
}

/**
 * Inline component to start the project transfer process.
 * Also houses the modal for the transfer process.
 */
export default function TransferProjects(props: TransferProjectsProps) {
  const [transfer, setTransfer] = useState<TransferProjectsState>({
    isModalOpen: false,
    invitedUserName: props.asset.project_ownership
      ? props.asset.project_ownership.recipient
      : null,
    usernameInput: '',
    usernameError: false,
    inviteStatus: props.asset.project_ownership
      ? props.asset.project_ownership.status
      : null,
    inviteUrl: props.asset.project_ownership
      ? props.asset.project_ownership.invite
      : null,
    submitPending: false,
  });

  const updateUsername = (newUsername: string) => {
    setTransfer({
      ...transfer,
      usernameInput: newUsername,
      usernameError: false,
    });
  };

  const toggleModal = () => {
    setTransfer({
      ...transfer,
      isModalOpen: !transfer.isModalOpen,
      usernameInput: '',
    });
  };

  function submitInvite(username: string) {
    if (username === sessionStore.currentAccount.username) {
      setTransfer({
        ...transfer,
        usernameError: t('Cannot transfer a project to the same account.'),
      });

      return;
    }

    if (username !== '') {
      setTransfer({...transfer, usernameError: false, submitPending: true});
      sendInvite(username, props.asset.uid)
        .then((data) => {
          if (data) {
            setTransfer({
              ...transfer,
              invitedUserName: username,
              inviteStatus: data?.status,
              inviteUrl: data?.url,
              isModalOpen: false,
              usernameInput: '',
              submitPending: false,
            });
          }
        })
        .catch((err) => {
          if (err.status === 400) {
            setTransfer({
              ...transfer,
              usernameError: t('User not found. Please try again.'),
            });
          }

          setTransfer({...transfer, submitPending: false});
        });
    } else {
      setTransfer({...transfer, usernameError: t('Please enter a user name.')});
    }
  }

  function cancelCurrentInvite() {
    if (transfer.inviteUrl) {
      cancelInvite(transfer.inviteUrl).then((data) => {
        if (data) {
          setTransfer({
            ...transfer,
            inviteStatus: data.status,
            invitedUserName: null,
          });
        }
      });
    }
  }

  if (props.asset.owner__username === sessionStore.currentAccount.username) {
    return (
      <div className={styles.root}>
        <div className={styles.bar}>
          <div className={styles.description}>
            <strong>{t('Transfer project ownership')}</strong>
            <div className={styles.copy}>
              {transfer.inviteStatus === TransferStatuses.Pending ? (
                <div
                  dangerouslySetInnerHTML={{
                    __html: t(
                      'Your transfer request is pending until ##username## has accepted or declined it.'
                    ).replace(
                      '##username##',
                      `<strong>${
                        transfer.invitedUserName ? transfer.invitedUserName : ''
                      }</strong>`
                    ),
                  }}
                />
              ) : (
                <span>
                  {t(
                    'Transfer ownership of this project to another user. All submissions, data storage, and transcription and translation usage for this project will be transferred to the new project owner.'
                  )}
                  &nbsp;
                  <a
                    href={
                      envStore.data.support_url +
                      HELP_ARTICLE_ANON_SUBMISSIONS_URL
                    }
                    target='_blank'
                  >
                    {t('Learn more →')}
                  </a>
                </span>
              )}
            </div>
          </div>

          {transfer.inviteStatus === TransferStatuses.Pending && (
            <Button
              className={styles.transferButton}
              label={t('Cancel transfer')}
              isFullWidth
              onClick={cancelCurrentInvite}
              type='secondary-danger'
              size='l'
            />
          )}

          {transfer.inviteStatus !== TransferStatuses.Pending && (
            <Button
              className={styles.transferButton}
              label={t('Transfer')}
              isFullWidth
              onClick={toggleModal}
              type='secondary'
              size='l'
            />
          )}
        </div>

        <KoboModal
          isOpen={transfer.isModalOpen}
          onRequestClose={toggleModal}
          size='medium'
        >
          <KoboModalHeader onRequestCloseByX={toggleModal} headerColor='white'>
            {t('Transfer ownership')}
          </KoboModalHeader>
          {/* Auto comeplete off as the feild will be filled by your own username
          which is who you definitely don’t want to use here */}
          <form autoComplete='off' className={styles.form}>
            <section className={styles.modalBody}>
              <p>
                {t(
                  'This action will transfer ownership of ##username## to another user'
                ).replace('##username##', props.asset.name)}
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

              <InlineMessage
                type='error'
                icon='warning'
                message={(
                  <div>
                    {t('You will be the owner of the project until the transfer is accepted.')}
                    <br />
                    <strong>
                      {t('Once the transfer is accepted, you will not be able to undo this action.')}
                    </strong>
                    &nbsp;
                    <a
                      href={envStore.data.support_url + HELP_ARTICLE_ANON_SUBMISSIONS_URL}
                      target='_blank'
                    >
                      {t('Learn more')}
                    </a>
                  </div>
                )}
              />

              {/* Unused element to prevent firefox autocomplete suggestions on username field */}
              <input type='text' style={{display: 'none'}} />
              <div>
                <TextBox
                  label={t('To complete the transfer, enter the username of the new project owner')}
                  type='text'
                  value={transfer.usernameInput}
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
                type='secondary'
                size='m'
              />
              <Button
                label={t('Transfer project')}
                onClick={(evt: React.FormEvent<HTMLFormElement>) => {
                  evt.preventDefault();
                  submitInvite(transfer.usernameInput);
                }}
                isPending={transfer.submitPending}
                type='primary'
                size='m'
                isSubmit
              />
            </KoboModalFooter>
          </form>
        </KoboModal>
      </div>
    );
  } else {
    return null;
  }
}
