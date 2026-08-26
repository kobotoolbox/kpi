/**
 * Entry point of the standalone error pages app (404 / 50x), built as its own
 * webpack bundle so it renders even when the main app can't.
 *
 * NOTE: Keep this bundle self-contained: don't import from `#/theme`,
 * `#/components/common`, `#/utils`, any store, or anything touching the API
 * layer, because those can drag in most of the main app. Import Mantine
 * primitives directly instead. `scripts/check_error_bundle_isolation.js` fails
 * the build if this entry starts sharing a chunk with the main app, but it can
 * only catch the worst case.
 *
 * Translations come from Django's JS catalog via the global `t()`, which the
 * template loads, so there's no i18n machinery here either.
 */

import { MantineProvider } from '@mantine/core'
import { createRoot } from 'react-dom/client'
// Only the Mantine styles these pages use. The whole `@mantine/core/styles.css`
// would add roughly 28KB gzipped.
import '@mantine/core/styles/baseline.css'
import '@mantine/core/styles/default-css-variables.css'
import '@mantine/core/styles/global.css'
import '@mantine/core/styles/Paper.css'
import '@mantine/core/styles/Anchor.css'
import ErrorPage, { type ErrorCode } from './ErrorPage'
import { errorTheme } from './errorTheme'

const MOUNT_NODE_ID = 'kobo-error-app'
const SUPPORTED_ERROR_CODES: ErrorCode[] = [404, 500]

function parseErrorCode(value: string | undefined): ErrorCode {
  const matched = SUPPORTED_ERROR_CODES.find((code) => String(code) === value)
  // Anything unexpected renders as a 500. For an unknown server-side failure
  // that's a safer message than claiming the page doesn't exist.
  return matched ?? 500
}

const mountNode = document.getElementById(MOUNT_NODE_ID)

if (!mountNode) {
  throw new Error(`Mount node "${MOUNT_NODE_ID}" not found!`)
}

// Empty attributes mean "not configured" and fall back to Kobo defaults, which
// is also what happens when the server couldn't read its own branding config.
const { errorCode, backgroundUrl, logoUrl, termsOfServiceUrl, privacyPolicyUrl } = mountNode.dataset

createRoot(mountNode).render(
  <MantineProvider theme={errorTheme}>
    <ErrorPage
      errorCode={parseErrorCode(errorCode)}
      backgroundUrl={backgroundUrl || undefined}
      logoUrl={logoUrl || undefined}
      termsOfServiceUrl={termsOfServiceUrl || undefined}
      privacyPolicyUrl={privacyPolicyUrl || undefined}
    />
  </MantineProvider>,
)
