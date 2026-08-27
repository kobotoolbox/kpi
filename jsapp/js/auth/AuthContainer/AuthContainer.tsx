import { Anchor } from '@mantine/core'
import cx from 'classnames'
import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { AuthThemeEnum } from '#/api/models/authThemeEnum'
import StandaloneUILanguageSelector from '#/auth/StandaloneUILanguageSelector'
import defaultThemeLogoUrl from '../../../img/kobo-logo-gray.svg'
import customThemeLogoUrl from '../../../img/kobologo.svg'
import styles from './AuthContainer.module.scss'
import { useAuthConfiguration } from './useAuthConfiguration'

/**
 * The page frame shared by every authentication screen: background, KoboToolbox logo, language picker
 * and legal links. The screen itself (sign-in, registration, password recovery, …) renders into the
 * `<Outlet/>`.
 *
 * The server picks the theme: `default` draws Kobo's gradient wedge, `custom` covers the page with the
 * administrator's photo and flips the logo, language pill and footer links to light-on-dark.
 *
 * DOM order is deliberately the tab order: logo, language picker, card contents, footer.
 */
export default function AuthContainer() {
  // The frame renders on the default theme right away and picks up the logo, footer links and
  // background photo once `/environment` lands. Waiting on that request would delay the sign-in form
  // just to avoid a brief flash - a bad trade for someone on a slow connection.
  const { data } = useAuthConfiguration()
  const { authConfiguration, termsOfServiceUrl, privacyPolicyUrl } = data ?? {}

  // A custom background is an arbitrary photo, so it gets a darkening overlay. Our own gradient wedge
  // is light enough already and must not be overlaid.
  const hasCustomBackground = authConfiguration?.theme === AuthThemeEnum.custom
  const logoUrl = hasCustomBackground ? customThemeLogoUrl : defaultThemeLogoUrl

  return (
    <div
      className={cx(styles.background, { [styles['background--custom']]: hasCustomBackground })}
      style={
        hasCustomBackground && authConfiguration?.background_image_url
          ? { backgroundImage: `url('${authConfiguration.background_image_url}')` }
          : undefined
      }
    >
      <header className={styles.header}>
        {authConfiguration?.show_kobotoolbox_logo && (
          // A plain anchor, not a router link: what lives at `/` depends on whether there's a session,
          // so leaving these screens needs a full page load.
          <a className={styles.logoLink} href='/'>
            {/* Named rather than decorative, because it's the link's only content - an empty `alt`
                would leave the link with no accessible name. Brand name, so no `t()`. */}
            <img className={styles.logo} src={logoUrl} alt='KoboToolbox' />
          </a>
        )}

        <StandaloneUILanguageSelector className={styles.languageSelector} hasCustomBackground={hasCustomBackground} />
      </header>

      <main className={styles.main}>
        {/* Screens are lazy loaded. The boundary sits here so switching between them doesn't blank the frame. */}
        <Suspense fallback={null}>
          <Outlet />
        </Suspense>
      </main>

      <footer className={cx(styles.footer, { [styles['footer--custom']]: hasCustomBackground })}>
        {termsOfServiceUrl && (
          <Anchor className={styles.footerLink} href={termsOfServiceUrl}>
            {t('Terms of Service')}
          </Anchor>
        )}

        {termsOfServiceUrl && privacyPolicyUrl && <span className={styles.footerMiddot}>&middot;</span>}

        {privacyPolicyUrl && (
          <Anchor className={styles.footerLink} href={privacyPolicyUrl}>
            {t('Privacy Policy')}
          </Anchor>
        )}
      </footer>
    </div>
  )
}
