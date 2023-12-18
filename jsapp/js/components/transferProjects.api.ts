import type {PaginatedResponse} from 'js/dataInterface';
import {fetchGet, fetchPost, fetchPatch} from 'jsapp/js/api';
import {ROOT_URL} from '../constants';

const INVITE_URL = '/api/v2/project-ownership/invites/';
const USERNAME_URL = ROOT_URL + '/api/v2/users/';
const ASSET_URL = ROOT_URL + '/api/v2/assets/';

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

export interface ProjectTransfer {
  url: string;
  asset: string;
  status: string;
  error: any;
  date_modified: string;
}

export interface InvitesResponse {
  url: string;
  recipient: string;
  status: string;
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

export async function cancelInvite(inviteUid: string) {
  return fetchPatch<InvitesResponse>(INVITE_URL + inviteUid, {
    status: TransferStatuses.Cancelled,
  });
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
