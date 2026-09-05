import { useMutation } from '@tanstack/react-query'
import { fetchPost } from '#/api'
import { endpoints } from '#/api.endpoints'

export const useLogoutAll = () =>
  useMutation({
    mutationFn: () => fetchPost(endpoints.LOGOUT_ALL, {}),
  })
