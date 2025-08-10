/**
 * API response doesn't have a enum.
 * TODO: improve OpenAPI schema.
 */
export enum MemberInviteStatus {
  accepted = 'accepted',
  cancelled = 'cancelled',
  declined = 'declined',
  expired = 'expired',
  pending = 'pending',
  resent = 'resent',
}

/**
 * Failed attempt at workaround on frontend to extend the interface manually.
 * Interface extensions doesn't allow narrowing down types.
 */
declare module '#/api/models/inviteResponse' {
  // export interface InviteResponse {
  //   status: MemberInviteStatus
  // }
}
