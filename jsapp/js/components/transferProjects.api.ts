import type {PaginatedResponse} from 'js/dataInterface';
import {fetchGet, fetchPost, fetchPatch} from 'jsapp/js/api';
import {ROOT_URL} from '../constants';
import sessionStore from 'js/stores/session';
import {getUsernameFromUrl} from 'js/users/utils';

const INVITE_URL = '/api/v2/project-ownership/invites/';
const USERNAME_URL = ROOT_URL + '/api/v2/users/';

/**
 * The status of a project transfer.
 */
export enum TransferStatuses {
  /**Sender sent the invite, recipient has accepted it but process has not started yet*/
  Accepted = 'accpeted',
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
  status: TransferStatuses;
  error: any;
  date_modified: string;
}

/**Detail about current asset's transfer. This is listed in the asset detail.*/
export interface ProjectTransferAssetDetail {
  invite: string,
  sender: string,
  recipient: string,
  status: TransferStatuses,
}

export interface InvitesResponse {
  url: string;
  recipient: string;
  status: TransferStatuses;
  date_created: string;
  date_modified: string;
  /**
   * Backend is written such that invites can have multiple
   * projects per transfer. This is not supported by the UI right now.
   */
  transfer: ProjectTransfer[];
}

export async function sendInvite(username: string, assetUid: string) {
  return fetchPost<InvitesResponse>(INVITE_URL, {
    recipient: USERNAME_URL + username + '/',
    assets: [assetUid],
  });
}

export async function cancelInvite(inviteUrl: string) {
  return fetchPatch<InvitesResponse>(
    inviteUrl,
    {
      status: TransferStatuses.Cancelled,
    },
    {prependRootUrl: false}
  );
}

/**Returns *all invites* the current user sent or recieved.*/
export async function getAllInvites() {
  return fetchGet<PaginatedResponse<InvitesResponse>>(INVITE_URL);
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
  getInviteDetail(inviteUid).then((data) => {
    inviteIsCorrect =
      sessionStore.currentAccount.username ===
      getUsernameFromUrl(data.recipient);
  });

  return inviteIsCorrect;
}
