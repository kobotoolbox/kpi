import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { notify } from '#/utils'

const PENDING_TRANSFERS_KEY = (orgId: string) => ['pendingOwnerTransfers', orgId]

// TODO: replace with orval-generated react query hook
const transferOwnershipRequest = (_orgId: string, _username: string): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 1500))

export function usePendingOwnerTransfers(orgId: string): string[] {
  const { data } = useQuery<string[]>({
    queryKey: PENDING_TRANSFERS_KEY(orgId),
    initialData: [],
    queryFn: () => [],
    staleTime: Number.POSITIVE_INFINITY,
  })
  return data
}

export function useTransferOwnership(orgId: string) {
  const queryClient = useQueryClient()

  const { mutate, isPending } = useMutation({
    mutationFn: (username: string) => transferOwnershipRequest(orgId, username),
    onSuccess: (_data, username) => {
      queryClient.setQueryData<string[]>(PENDING_TRANSFERS_KEY(orgId), (prev = []) => [...prev, username])
      notify(t('Transfer request sent'), 'success')
    },
    onError: () => notify(t('Transfer request failed'), 'error'),
  })

  return { transferOwnership: mutate, isPending }
}
