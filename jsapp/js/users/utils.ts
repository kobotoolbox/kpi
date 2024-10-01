import constants from 'js/constants';

/** Make sure to not call this with a user url :) */
export function buildUserUrl(username: string): string {
  return `${constants.ROOT_URL}/api/v2/users/${username}/`;
}

// works universally for v1 and v2 urls
export function getUsernameFromUrl(userUrl: string): string | null {
  const matched = userUrl.match(/\/users\/(.*)\//);
  if (matched !== null) {
    return matched[1];
  }
  return null;
}

export const ANON_USERNAME = 'AnonymousUser';

export const ANON_USERNAME_URL = buildUserUrl(ANON_USERNAME);
