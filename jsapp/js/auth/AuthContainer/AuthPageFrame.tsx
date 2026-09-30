import { Anchor } from '@mantine/core'
import cx from 'classnames'
import { useMemo } from 'react'
import { AuthThemeEnum } from '#/api/models/authThemeEnum'
import StandaloneUILanguageSelector from '#/auth/StandaloneUILanguageSelector'
import defaultThemeLogoUrl from '../../../img/kobo-logo-gray.svg'
import customThemeLogoUrl from '../../../img/kobologo.svg'
import styles from './AuthPageFrame.module.scss'
import { useAuthConfiguration } from './useAuthConfiguration'

/** Returns `undefined` if no custom image is set - meta tag is set by `index.html` */
function getInitialBackgroundImageUrl() {
  return document.head.querySelector<HTMLMetaElement>('meta[name=login-background-url]')?.content
}

export interface AuthPageFrameProps {
  /** The screen itself, usually a single `AuthCard`. */
  children: React.ReactNode
}

/**
 * The page frame shared by every authentication screen: background, KoboToolbox logo, language picker
 * and legal links. The server decides on the theme.
 * DOM order is deliberately the tab order.
 */
export default function AuthPageFrame({ children }: AuthPageFrameProps) {
  // The frame renders right away and picks up the logo and footer links once `/environment` lands
  const { data } = useAuthConfiguration()
  const { authConfiguration, termsOfServiceUrl, privacyPolicyUrl } = data ?? {}
  // The background is the exception: we don't show the default one - to not blink it for split second before
  // swapping it with the custom one.
  // Read once on mount: the meta tag is baked into the served HTML and never changes afterwards.
  const initialBackgroundImageUrl = useMemo(getInitialBackgroundImageUrl, [])
  const hasCustomBackground = data
    ? authConfiguration?.theme === AuthThemeEnum.custom
    : initialBackgroundImageUrl !== undefined
  const backgroundImageUrl = data ? authConfiguration?.background_image_url : initialBackgroundImageUrl

  const logoUrl = hasCustomBackground ? customThemeLogoUrl : defaultThemeLogoUrl

  return (
    <div
      className={cx(styles.background, { [styles['background--custom']]: hasCustomBackground })}
      style={
        hasCustomBackground && backgroundImageUrl ? { backgroundImage: `url('${backgroundImageUrl}')` } : undefined
      }
    >
      <header className={styles.header}>
        {authConfiguration?.show_kobotoolbox_logo && (
          <a className={styles.logoLink} href='/'>
            <img className={styles.logo} src={logoUrl} alt='KoboToolbox' />
          </a>
        )}

        <StandaloneUILanguageSelector className={styles.languageSelector} hasCustomBackground={hasCustomBackground} />
      </header>

      <main className={styles.main}>{children}</main>

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
