import type { Decorator } from '@storybook/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { applyManageProjectsMutationDefaults } from '#/api/mutation-defaults/manage-projects-and-library-content'
import { applySurveyDataMutationDefaults } from '#/api/mutation-defaults/survey-data'
import { applyUserTeamOrganizationMutationDefaults } from '#/api/mutation-defaults/user-team-organization-usage'

export const queryClientDecorator: Decorator = (Story) => {
  // We define a new QueryClient for each story to avoid sharing state between stories.
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

  // Apply mutation defaults so stories have the same invalidation behavior as production
  applySurveyDataMutationDefaults(mockQueryClient)
  applyManageProjectsMutationDefaults(mockQueryClient)
  applyUserTeamOrganizationMutationDefaults(mockQueryClient)

  return <QueryClientProvider client={mockQueryClient}>{Story()}</QueryClientProvider>
}
