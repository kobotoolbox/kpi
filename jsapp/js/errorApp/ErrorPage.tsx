import { Anchor, Paper } from '@mantine/core'
import cx from 'classnames'
import errorIllustration from '../../img/error-illustration.svg'
import defaultLogoUrl from '../../img/kobo-logo-gray.svg'
import styles from './ErrorPage.module.scss'

/** HTTP status codes these pages know how to render. */
export type ErrorCode = 404 | 500

function getErrorContent(errorCode: ErrorCode) {
  if (errorCode === 500) {
    return {
      title: t('Server error (500)'),
      message: t('Something went wrong when trying to process your request.'),
    }
  }

  return {
    title: t('Page not found (404)'),
    message: t('This page does not exist on the server. Please check the URL or link that sent you here.'),
  }
}

export interface ErrorPageProps {
  errorCode: ErrorCode
  /** Admin-uploaded background (`login_background`). Falls back to the Kobo gradient shape. */
  backgroundUrl?: string
  /** Admin-uploaded logo (`logo`). Falls back to the KoboToolbox logo. */
  logoUrl?: string
  /** Both links are dropped from the footer when the instance hasn't set them. */
  termsOfServiceUrl?: string
  privacyPolicyUrl?: string
}

/**
 * The whole UI of the standalone error app. Renders from props only - it makes
 * no API calls and reads no stores, because it has to work when the rest of the
 * app (or the server behind it) doesn't.
 */
export default function ErrorPage(props: ErrorPageProps) {
  const { errorCode, backgroundUrl, logoUrl, termsOfServiceUrl, privacyPolicyUrl } = props
  const { title, message } = getErrorContent(errorCode)
  // A custom background is a photo, so it needs the darkening overlay. Our own
  // gradient wedge is drawn in CSS, is already light enough, and must not be overlaid.
  const hasCustomBackground = Boolean(backgroundUrl)

  return (
    <div
      className={cx(styles.background, { [styles['background--custom']]: hasCustomBackground })}
      style={hasCustomBackground ? { backgroundImage: `url('${backgroundUrl}')` } : undefined}
    >
      <header className={styles.header}>
        {/* Decorative, hence the empty alt; also and we can't describe whatever logo an admin uploaded */}
        <a className={styles.logoLink} href='/'>
          <img className={styles.logo} src={logoUrl ?? defaultLogoUrl} alt='' />
        </a>
      </header>

      <main className={styles.main}>
        <Paper className={styles.card} component='section'>
          <img className={styles.cardIllustration} src={errorIllustration} alt='' />
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.message}>{message}</p>
        </Paper>
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
