/**
 * Note: invites APIs return objects with a URL property with an ID within but no ID property.
 */
export const inviteGuidFromUrl = (url: string) => url.slice(0, -1).split('/').pop()!
