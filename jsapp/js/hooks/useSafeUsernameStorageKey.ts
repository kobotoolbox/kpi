import {useEffect, useState} from 'react';

/**
 * A hook for generating a key for `localStorage`/`sessionStorage` that includes encrypted username.
 */
export function useSafeUsernameStorageKey(
  prefix: string,
  username: string,
) {
  const [key, setKey] = useState<string | undefined>();

  // When this component is mounted, create the localStorage key we'll use
  useEffect(() => {
    (async () => {
      if (crypto.subtle) {
        // Let's avoid leaving behind an easily-accessible list of all users
        // who've logged in with this browser
        // https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest
        const encoder = new TextEncoder();
        const encoded = encoder.encode(username);
        const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
        const hashArray = Array.from(new Uint8Array(hashBuffer)); // convert buffer to byte array
        const hashHex = hashArray
          .map((b) => b.toString(16).padStart(2, '0'))
          .join(''); // convert bytes to hex string
        setKey(`${prefix}-${hashHex}`);
      } else {
        // `crypto.subtle` is only available in secure (https://) contexts
        setKey(`${prefix}-FOR DEVELOPMENT ONLY-${username}`);
      }
    })();
  }, []);

  return key;
}
