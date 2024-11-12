import React from 'react';
import Icon from 'js/components/common/icon';
import Button from 'js/components/common/button';
import {TransferStatuses} from 'js/components/permissions/transferProjects/transferProjects.api';
import styles from './projectTransferInviteBanner.module.scss';

export interface TransferInviteState {
  valid: boolean;
  uid: string;
  status: TransferStatuses.Accepted | TransferStatuses.Declined | null;
  name: string;
  currentOwner: string;
}

interface ProjectTransferInviteBannerProps {
  invite: TransferInviteState;
  onRequestClose: () => void;
}

/**
 * Displays a banner about accepting or declining project transfer invitation.
 */
export default function ProjectTransferInviteBanner(props: ProjectTransferInviteBannerProps) {
  if (props.invite.status) {
    return (
      <div className={styles.banner}>
        <Icon
          name='information'
          color='blue'
          className={styles.bannerIcon}
        />

        {props.invite.status === TransferStatuses.Declined && (
          <>
            {t('You have declined the request of transfer ownership for ##PROJECT_NAME##. ##CURRENT_OWNER_NAME## will receive a notification that the transfer was incomplete.')
              .replace('##PROJECT_NAME##', props.invite.name)
              .replace('##CURRENT_OWNER_NAME##', props.invite.currentOwner)}
            &nbsp;
            {t('##CURRENT_OWNER_NAME## will remain the project owner.')
              .replace('##CURRENT_OWNER_NAME##', props.invite.currentOwner)}
          </>
        )}

        {props.invite.status === TransferStatuses.Accepted && (
          <>
            {t('You have accepted project ownership from ##CURRENT_OWNER_NAME## for ##PROJECT_NAME##. This process can take up to a few minutes to complete.')
              .replace('##PROJECT_NAME##', props.invite.name)
              .replace('##CURRENT_OWNER_NAME##', props.invite.currentOwner)}
          </>
        )}

        <Button
          type='text'
          size='s'
          startIcon='close'
          onClick={() => {props.onRequestClose();}}
          className={styles.bannerButton}
        />
      </div>
    );
  }

  return null;
}
