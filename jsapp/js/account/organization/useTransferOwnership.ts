import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { notify } from '#/utils'

// Mocked — both hooks are inert until transferOwnership() is called, which only
// happens behind the transferTeamOwnership flag.
//
// TODO: Replace mutationFn with the real hook once the endpoint exists.
const PENDING_TRANSFERS_KEY = (orgId: string) => ['pendingOwnerTransfers', orgId]

// TODO: swap this function out when the real endpoint is ready
const mockTransferOwnership = (_username: string): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, 1500))

export function usePendingOwnerTransfers(orgId: string): string[] {
  const { data } = useQuery<string[]>({
    queryKey: PENDING_TRANSFERS_KEY(orgId),
    initialData: [],
    queryFn: () => [],
    staleTime: Infinity,
  })
  return data
}

export function useTransferOwnership(orgId: string) {
  const queryClient = useQueryClient()

  const { mutate, isPending } = useMutation({
    mutationFn: (username: string) => mockTransferOwnership(username),
    onSuccess: (_data, username) => {
      queryClient.setQueryData<string[]>(
        PENDING_TRANSFERS_KEY(orgId),
        (prev = []) => [...prev, username],
      )
      notify(t('Transfer request sent'), 'success')
    },
    onError: () => notify(t('Transfer request failed'), 'error'),
  })

  return { transferOwnership: mutate, isPending }
}
