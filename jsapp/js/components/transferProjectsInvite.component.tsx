import React, {useState, useEffect} from 'react';
import KoboModal from 'js/components/modals/koboModal';
import KoboModalHeader from 'js/components/modals/koboModalHeader';
import KoboModalFooter from 'js/components/modals/koboModalFooter';
import Button from 'js/components/common/button';
import Icon from 'js/components/common/icon';

import styles from './transferProjectsInvite.module.scss';
import {acceptInvite, declineInvite, getAssetFromInviteUid} from './transferProjects.api';
import {AssetResponse} from '../dataInterface';
import {set} from 'alertifyjs';

interface DisplayDetails {
  assetName: string;
  assetOwner: string;
}

interface TransferProjectsInviteProps {
  inviteUid: string;
}

export default function TransferProjectsInvite(props: TransferProjectsInviteProps) {
  const [isModalOpen, setIsModalOpen] = useState(true);
  const [isDeclined, setIsDeclined] = useState(false);
  const [asset, setAsset] = useState<DisplayDetails | null>(null);

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

  let noteClass = styles.note;
  if (isDeclined) {
    noteClass = [noteClass, styles.declinedNote].join(' ');
  }

  function decline() {
    declineInvite(props.inviteUid).then(() => {
      setIsDeclined(true);
    });
  }

  function accept() {
    acceptInvite(props.inviteUid).then(() => {
      setIsModalOpen(!isModalOpen);
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
          {isDeclined ? (
            <p>
              {t(
                'You have declined the request of transfer ownership for ##PROJECT_NAME##.'
              ).replace('##PROJECT_NAME##', asset ? asset.assetName : '')}
            </p>
          ) : (
            <p>
              {t(
                'When you accept the ownership transfer of project ##PROJECT_NAME##, all of the submissions, data storage, and transcription and translation usage for the project will be transferred to you and count against your plan limits.'
              ).replace('##PROJECT_NAME##', asset ? asset.assetName : '')}
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
            {isDeclined && asset ? (
              <div>
                {'##CURRENT_OWNER_NAME## will receive a notification that the transfer was incomplete.'.replace(
                  '##CURRENT_OWNER_NAME##',
                  asset ? asset.assetOwner : ''
                )}
                &nbsp;
                {'##CURRENT_OWNER_NAME## will remain the project owner.'.replace(
                  '##CURRENT_OWNER_NAME##',
                  asset ? asset.assetOwner : ''
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
              color='blue'
              type='frame'
              size='l'
            />
            <Button
              label={t('Accept')}
              onClick={accept}
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
