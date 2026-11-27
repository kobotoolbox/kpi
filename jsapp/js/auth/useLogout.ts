import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { fetchPost } from '#/api'
import { endpoints } from '#/api.endpoints'
import type { LogoutResponse } from '#/api/models/logoutResponse'

export const useLogout = () =>
  useMutation({
    mutationFn: () => fetchPost<LogoutResponse>(endpoints.LOGOUT, {}),
    onSuccess: (data) => {
      const targetUrl = data?.redirect_url
      if (targetUrl && (targetUrl.startsWith('http://') || targetUrl.startsWith('https://'))) {
        window.location.href = targetUrl
        return
      }
      window.location.replace('')
    },
    onError: () => null,
  })

/**
 * Logs out and reloads onto the login screen (or redirects to the IdP for RP-initiated logout) - the way out of a
 * route blocker. Show `error` on the screen, since a silently failed logout leaves the user stuck.
 */
export function useLogoutAndReload() {
  const logout = useLogout()
  const [error, setError] = useState<string>()

  async function logOut() {
    setError(undefined)
    try {
      await logout.mutateAsync()
    } catch {
      // Only a 5xx or a dead connection gets here
      setError(t('Could not log you out. Please try again later.'))
    }
  }

  return { logOut, isPending: logout.isPending, error }
}
