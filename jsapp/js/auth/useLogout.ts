import { useMutation } from '@tanstack/react-query'
import { fetchPost } from '#/api'
import { endpoints } from '#/api.endpoints'

export interface LogoutResponse {
  location?: string
}

export const useLogout = () =>
  useMutation({
    mutationFn: () => fetchPost<LogoutResponse>(endpoints.LOGOUT, {}),
    onSuccess: (data) => {
      if (
        data?.location &&
        (data.location.startsWith('http://') || data.location.startsWith('https://'))
      ) {
        window.location.href = data.location
        return
      }
      window.location.replace('')
    },
    onError: () => null,
  })
