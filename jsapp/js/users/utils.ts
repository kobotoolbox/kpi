import constants from 'js/constants';

export function buildUserUrl(username: string): string {
  if (username.startsWith(window.location.protocol)) {
    console.error(
      'buildUserUrl() called with URL instead of username (incomplete v2 migration)'
    );
    return username;
  }
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
