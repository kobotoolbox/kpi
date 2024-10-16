import React, {useState, useEffect} from 'react';
import {useSearchParams} from 'react-router-dom';
import KoboModal from 'js/components/modals/koboModal';
import KoboModalHeader from 'js/components/modals/koboModalHeader';
import KoboModalFooter from 'js/components/modals/koboModalFooter';
import Button from 'js/components/common/button';
import Icon from 'js/components/common/icon';
import cx from 'classnames';

import styles from './transferProjectsInvite.module.scss';
import {
  acceptInvite,
  declineInvite,
  getAssetFromInviteUid,
  TransferStatuses,
} from './transferProjects.api';

interface DisplayDetails {
  assetName: string;
  assetOwner: string;
}

interface TransferProjectsInviteProps {
  inviteUid: string;
  setInvite: Function;
}

/*
 * Invite modal that will show after clicking the invite sent through the email.
 *
 * For testing (without email), go to `[projects landing]?invite=<inviteUid>`.
 * A quick way to get the inviteUid after sending the request is through the
 * network response under `url`.
 *
 */
export default function TransferProjectsInvite(
  props: TransferProjectsInviteProps
) {
  const [isModalOpen, setIsModalOpen] = useState(true);
  const [isDeclined, setIsDeclined] = useState(false);
  const [declinePending, setDeclinePending] = useState(false);
  const [acceptPending, setAcceptPending] = useState(false);
  const [asset, setAsset] = useState<DisplayDetails | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    getAssetFromInviteUid(props.inviteUid).then((data) => {
      if (data) {
        setAsset(data);
      }
    });
  }, []);

  const toggleModal = () => {
    setIsModalOpen(!isModalOpen);
  };

  function decline() {
    setDeclinePending(true)
    declineInvite(props.inviteUid).then(() => {
      setIsDeclined(true);
      props.setInvite(
        TransferStatuses.Declined,
        asset?.assetName,
        asset?.assetOwner
      );
      setDeclinePending(false);
      setSearchParams();
    });
  }

  function accept() {
    setAcceptPending(true);
    acceptInvite(props.inviteUid).then(() => {
      setAcceptPending(false);
      setIsModalOpen(!isModalOpen);
      props.setInvite(
        TransferStatuses.Accepted,
        asset?.assetName,
        asset?.assetOwner
      );
      setSearchParams()
    });
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
          {isDeclined && (
            <p>
              {t(
                'You have declined the request of transfer ownership for ##PROJECT_NAME##.'
              ).replace('##PROJECT_NAME##', asset ? asset.assetName : '')}
            </p>
          )}

          {!isDeclined && (
            <>
              <p>
                {t(
                  'When you accept the ownership transfer of project ##PROJECT_NAME##, all of the submissions, data storage, and transcription and translation usage for the project will be transferred to you and count against your plan limits.'
                ).replace('##PROJECT_NAME##', asset ? asset.assetName : '')}
              </p>
              <strong>
                {t(
                  'Once you accept, the transfer might take a few minutes to complete.'
                )}
              </strong>
            </>
          )}
          <div
            className={cx({
              [styles.note]: true,
              [styles.declinedNote]: isDeclined,
            })}
          >
            <Icon
              name='information'
              size='s'
              color='blue'
              className={styles.noteIcon}
            />

            {isDeclined && asset ? (
              <div>
                {'##CURRENT_OWNER_NAME## will receive a notification that the transfer was incomplete.'.replace(
                  '##CURRENT_OWNER_NAME##',
                  asset ? asset.assetOwner : t('Current owner')
                )}
                &nbsp;
                {'##CURRENT_OWNER_NAME## will remain the project owner.'.replace(
                  '##CURRENT_OWNER_NAME##',
                  asset ? asset.assetOwner : t('Current owner')
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
              onClick={decline}
              type='secondary'
              size='l'
              isDisabled={acceptPending}
              isPending={declinePending}
            />
            <Button
              label={t('Accept')}
              onClick={accept}
              type='primary'
              size='l'
              isDisabled={declinePending}
              isPending={acceptPending}
            />
          </KoboModalFooter>
        )}
      </div>
    </KoboModal>
  );
}
