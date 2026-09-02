import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { QueryClientProvider } from '@tanstack/react-query'
import DocumentTitle from 'react-document-title'
import { queryClient } from '#/api/queryClient'
import { cssVariablesResolverKobo, themeKobo } from '#/theme'
import { Tracking } from '../router/useTracking'
import ToasterConfig from '../toasterConfig'

/**
 * Context the authentication screens need, mirroring what `#/router/basicLayout.component` sets up for
 * the logged in app. They can't reuse that layout - it also renders the main header, the drawer and the
 * route blockers, none of which belong on a sign-in page.
 */
export default function AuthAppProviders({ children }: { children: React.ReactNode }) {
  return (
    // TODO: give each auth screen its own title once there is more than one of them.
    <DocumentTitle title='KoboToolbox'>
      <QueryClientProvider client={queryClient}>
        <MantineProvider theme={themeKobo} cssVariablesResolver={cssVariablesResolverKobo}>
          <Notifications />
          {/* `notify()` renders through react-hot-toast, not Mantine - the language selector uses it when saving fails */}
          <ToasterConfig />
          <Tracking />
          {children}
        </MantineProvider>
      </QueryClientProvider>
    </DocumentTitle>
  )
}
