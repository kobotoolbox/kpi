import { MantineProvider } from '@mantine/core'
import { render, screen, within } from '@testing-library/react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import ErrorPage, { type ErrorPageProps } from './ErrorPage'
import { errorTheme } from './errorTheme'

/**
 * Renders with the same slim theme the real entry uses, so these tests exercise
 * the provider the bundle actually ships (not the full app theme).
 */
function renderErrorPage(props: Partial<ErrorPageProps> = {}) {
  return render(
    <MantineProvider theme={errorTheme}>
      <ErrorPage errorCode={404} {...props} />
    </MantineProvider>,
  )
}

const CUSTOM_BACKGROUND = 'https://testerrorapp.biz/somepath/login_background/'

/**
 * Finds an element the way a11y queries can't
 */
function getElement(container: HTMLElement, selector: string) {
  const element = container.querySelector<HTMLElement>(selector)
  if (!element) {
    throw new Error(`No element matching "${selector}"`)
  }
  return element
}

describe('ErrorPage', () => {
  it('renders the 404 copy', () => {
    renderErrorPage({ errorCode: 404 })

    chai.expect(screen.getByRole('heading', { level: 1 }).textContent).to.equal('Page not found (404)')
    chai.expect(screen.queryByText(/This page does not exist on the server/)).to.not.equal(null)
  })

  it('renders the 500 copy', () => {
    renderErrorPage({ errorCode: 500 })

    chai.expect(screen.getByRole('heading', { level: 1 }).textContent).to.equal('Server error (500)')
    chai.expect(screen.queryByText(/Something went wrong/)).to.not.equal(null)
  })

  it('uses the custom background when one is configured', () => {
    const { container } = renderErrorPage({ backgroundUrl: CUSTOM_BACKGROUND })
    const background = getElement(container, '.background')

    chai.expect(background.style.backgroundImage).to.contain(CUSTOM_BACKGROUND)
    // Custom (photo) backgrounds need the darkening overlay for legibility.
    chai.expect(background.className).to.contain('background--custom')
  })

  it('draws its own background in CSS when no custom background is configured', () => {
    const { container } = renderErrorPage({ backgroundUrl: undefined })
    const background = getElement(container, '.background')

    // The default gradient wedge is a pseudo-element, so there is no inline image
    // to set. No overlay either: it is a light gradient, not a photo.
    chai.expect(background.style.backgroundImage).to.equal('')
    chai.expect(background.className).to.not.contain('background--custom')
  })

  it('uses the custom logo when one is configured', () => {
    const logoUrl = 'https://testerrorapp.biz/somepath/logo/'
    const { container } = renderErrorPage({ logoUrl })

    chai.expect(getElement(container, 'img').getAttribute('src')).to.equal(logoUrl)
  })

  it('falls back to the KoboToolbox logo when no custom logo is configured', () => {
    const { container } = renderErrorPage({ logoUrl: undefined })

    chai.expect(getElement(container, 'img').getAttribute('src')).to.not.equal('')
  })

  it('renders the terms and privacy links when configured', () => {
    renderErrorPage({
      termsOfServiceUrl: 'https://testerrorapp.biz/tos',
      privacyPolicyUrl: 'https://testerrorapp.biz/privacy',
    })

    chai
      .expect(screen.getByRole('link', { name: 'Terms of Service' }).getAttribute('href'))
      .to.equal('https://testerrorapp.biz/tos')
    chai
      .expect(screen.getByRole('link', { name: 'Privacy Policy' }).getAttribute('href'))
      .to.equal('https://testerrorapp.biz/privacy')
  })

  it('omits the footer links when they are not configured', () => {
    const { container } = renderErrorPage()

    // Scoped to the footer, because the logo is a link to the homepage.
    chai.expect(within(getElement(container, 'footer')).queryAllByRole('link').length).to.equal(0)
  })

  it('replaces the fallback markup that the Django template renders', () => {
    // `error_page.html` puts a plain-HTML copy of the message inside the mount
    // node, so the page still says something when this bundle fails to load.
    // Mounting has to clear it, or the message would appear twice.
    const mountNode = document.createElement('div')
    mountNode.innerHTML = '<div class="error-page-fallback"><h1>Page not found (404)</h1></div>'
    document.body.appendChild(mountNode)

    act(() => {
      createRoot(mountNode).render(
        <MantineProvider theme={errorTheme}>
          <ErrorPage errorCode={404} />
        </MantineProvider>,
      )
    })

    chai.expect(mountNode.querySelector('.error-page-fallback')).to.equal(null)
    chai.expect(mountNode.querySelectorAll('h1').length).to.equal(1)
  })
})
