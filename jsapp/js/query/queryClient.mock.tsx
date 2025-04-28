import type { DecoratorFunction } from '@storybook/core/csf'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

export const queryClientDecorator: DecoratorFunction = (Story) => {
  const mockQueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Some defaults to avoid messing up other stories
        retry: false,
       staleTime: 0,
       refetchOnWindowFocus: false,
     },
   },
 });
 return (
   <QueryClientProvider client={mockQueryClient}>{Story()}</QueryClientProvider>
 );
};
