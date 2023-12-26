import {
  AssetResponse,
  dataInterface,
  PaginatedResponse,
} from 'js/dataInterface';
import {fetchGet, fetchPost, fetchPatch} from 'jsapp/js/api';
import {ROOT_URL} from '../constants';
import sessionStore from 'js/stores/session';
import {getUsernameFromUrl} from 'js/users/utils';
import {notify} from 'js/utils';

const INVITE_URL = '/api/v2/project-ownership/invites/';
const USERNAME_URL = ROOT_URL + '/api/v2/users/';

/**
 * The status of a project transfer.
 */
export enum TransferStatuses {
  /**Sender sent the invite, recipient has accepted it but process has not started yet*/
  Accepted = 'accepted',
  /**Sender sent the invite but cancelled it before the recipient could respond.*/
  Cancelled = 'cancelled',
  /**Recipient has accepted and transfer has completed successfully.*/
  Complete = 'complete',
  /**Recipient has declined the invite.*/
  Declined = 'declined',
  /**Recipient has accepted and process went south.*/
  Failed = 'failed',
  /**Recipient has accepted and process has begun.*/
  InProgress = 'in_progress',
  /**Sender sent the invite but recipient hasn't responded yet.*/
  Pending = 'pending',
}

/**Detail about a single asset's transfer. This is listed in the invite detail.*/
export interface ProjectTransfer {
  url: string;
  asset: string;
  asset__name: string;
  status: TransferStatuses;
  error: any;
  date_modified: string;
}

/**Detail about current asset's transfer. This is listed in the asset detail.*/
export interface ProjectTransferAssetDetail {
  invite: string;
  sender: string;
  recipient: string;
  status: TransferStatuses;
}

export interface InvitesResponse {
  url: string;
  sender: string;
  recipient: string;
  status: TransferStatuses;
  date_created: string;
  date_modified: string;
  /**
   * Backend is written such that invites can have multiple
   * projects per transfer. This is not supported by the UI right now.
   */
  transfers: ProjectTransfer[];
}

export async function sendInvite(username: string, assetUid: string) {
  return fetchPost<InvitesResponse>(INVITE_URL, {
    recipient: USERNAME_URL + username + '/',
    assets: [assetUid],
  });
}

// Note: the following invite actions are seperated to make it clearer when using in
// the JSX code.

export async function cancelInvite(inviteUrl: string) {
  let response;
  try {
    response = await fetchPatch<InvitesResponse>(
      inviteUrl,
      {
        status: TransferStatuses.Cancelled,
      },
      {prependRootUrl: false}
    );
  } catch (error) {
    console.error(error);
    notify.error(
      t(
        'Failed to cancel transfer. The transfer may be declined or accpeted already. Please check your email.'
      )
    );
  }

  return response;
}

export async function acceptInvite(inviteUid: string) {
  let response;
  try {
    response = await fetchPatch<InvitesResponse>(
      INVITE_URL + inviteUid + '/',
      {
        status: TransferStatuses.Accepted,
      },
      {prependRootUrl: false}
    );
  } catch (error) {
    console.error(error);
    notify.error(t('Failed to accept invite.'));
  }

  return response;
}

export async function declineInvite(inviteUid: string) {
  let response;
  try {
    response = await fetchPatch<InvitesResponse>(
      INVITE_URL + inviteUid + '/',
      {
        status: TransferStatuses.Declined,
      },
      {prependRootUrl: false}
    );
  } catch (error) {
    console.error(error);
    notify.error(t('Failed to decline invite'));
  }
  return response;
}

/**Returns *all invites* the current user sent or recieved.*/
export async function getAllInvites() {
  let invites;
  try {
    invites = await fetchGet<PaginatedResponse<InvitesResponse>>(INVITE_URL);
  } catch (error) {
    console.error(error);
  }

  return invites;
}

/**
 * Returns detail for a single invite.
 *
 * Note: backend is written such that invites can have multiple
 * projects per transfer. This is not supported by the UI right now.
 */
export async function getInviteDetail(inviteUid: string) {
  return fetchGet<InvitesResponse>(INVITE_URL + inviteUid);
}

/** Check if the invite is meant for the currently logged in user. */
export async function checkInviteUid(inviteUid: string) {
  let inviteIsCorrect = false;
  try {
    await getInviteDetail(inviteUid).then((data) => {
      // Only bother with the check if it's in the `pending` state.
      if (data.status !== TransferStatuses.Pending) {
        notify.error(t('Invite has been expired or cancelled'));
        return;
      }

      inviteIsCorrect =
        sessionStore.currentAccount.username ===
        getUsernameFromUrl(data.recipient);
    });
  } catch (error) {
    console.error(error);
    notify.error(t('Invite is invalid'));
  }

  return inviteIsCorrect;
}

export async function getAssetFromInviteUid(inviteUid: string) {
  let displayDetails = null;
  try {
    await getInviteDetail(inviteUid).then((data) => {
      displayDetails = {
        assetName: data.transfers[0].asset__name,
        assetOwner: getUsernameFromUrl(data.sender),
      };
    });
  } catch (error) {
    console.error(error);
  }
  return displayDetails;
}
