import { useMutation } from '@tanstack/react-query'
import { fetchPost } from '#/api'
import { endpoints } from '#/api.endpoints'

export interface LogoutResponse {
  redirect_url?: string
  location?: string
}

export const useLogout = () =>
  useMutation({
    mutationFn: () => fetchPost<LogoutResponse>(endpoints.LOGOUT, {}),
    onSuccess: (data) => {
      const targetUrl = data?.redirect_url || data?.location
      if (
        targetUrl &&
        (targetUrl.startsWith('http://') || targetUrl.startsWith('https://'))
      ) {
        window.location.href = targetUrl
        return
      }
      window.location.replace('')
    },
    onError: () => null,
  })
