import { useState } from 'react'
import { useAllauthBrowserV1AuthSessionDelete } from '#/api/react-query/authentication-allauth-headless'

export const useLogout = () => useAllauthBrowserV1AuthSessionDelete()

/**
 * Logs out and reloads onto the login screen - the way out of a route blocker. Show `error` on the screen, since a
 * silently failed logout leaves the user stuck.
 */
export function useLogoutAndReload() {
  const logout = useLogout()
  const [error, setError] = useState<string>()

  async function logOut() {
    setError(undefined)
    try {
      await logout.mutateAsync()
      // No `next`, so nobody is brought back to the screen they just left.
      window.location.replace('')
    } catch {
      // Only a 5xx or a dead connection gets here
      setError(t('Could not log you out. Please try again later.'))
    }
  }

  return { logOut, isPending: logout.isPending, error }
}
