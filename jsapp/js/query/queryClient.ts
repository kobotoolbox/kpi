import { QueryClient } from '@tanstack/react-query'

// Some shared defaults and config can be set here!
// Docs: https://tanstack.com/query/v5/docs/reference/QueryClient#queryclient
// See: https://tanstack.com/query/v5/docs/framework/react/guides/important-defaults
const queryClient = new QueryClient()

export { queryClient }
