import { createTheme } from '@mantine/core'

/**
 * A deliberately minimal Mantine theme for the standalone error pages.
 *
 * We do NOT reuse `themeKobo` from `#/theme` here: that barrel registers ~30
 * component overrides and transitively pulls in `loadingSpinner`, `icon.scss`,
 * `#/k-icons` and `@tabler/icons-react`. This bundle has to stay small enough to
 * render when the main app can't, so it only declares what these pages use.
 *
 * Colors are left out on purpose: `ErrorPage.module.scss` takes them from the
 * shared Sass palette, so nothing here has to restate the Kobo scale.
 */
export const errorTheme = createTheme({
  fontFamily: '"Roboto", sans-serif',
})
