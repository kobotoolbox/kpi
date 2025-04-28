import type { DecoratorFunction } from '@storybook/core/csf'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const mockQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Some defaults to avoid messing up other stories
      retry: false,
      staleTime: 0,
      refetchOnWindowFocus: false,
    },
  },
})

export const queryClientDecorator: DecoratorFunction = (Story) => (
  <QueryClientProvider client={mockQueryClient}>{Story()}</QueryClientProvider>
)
