import { createTheme } from '@mantine/core'

/**
 * A deliberately minimal Mantine theme for the standalone error pages.
 * We do NOT reuse `themeKobo` from `#/theme` here, as it pulls in too many
 * things we don't use. Colors are left out on purpose: `ErrorPage.module.scss`
 * takes them from the shared palette.
 */
export const errorTheme = createTheme({
  fontFamily: '"Roboto", sans-serif',
})
