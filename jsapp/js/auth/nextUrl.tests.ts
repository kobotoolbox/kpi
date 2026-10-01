import chai from 'chai'
import { ACCOUNT_AUTH_ROUTES, AUTH_ROUTES } from '#/router/routerConstants'
import { getLoginRouteWithNext, getRouteWithNext, getUrlForNextRoute, readNextParam, resolveNextRoute } from './nextUrl'

const origin = { origin: 'https://kf.kobotoolbox.org', pathname: '/' }

describe('readNextParam', () => {
  it('reads what the server appended, which lands outside the fragment', () => {
    chai.expect(readNextParam('?next=%2Fadmin%2F', '')).to.equal('/admin/')
  })

  it('reads what a route of ours wrote, which lands inside the fragment', () => {
    chai.expect(readNextParam('', '?next=%2F%23%2Fprojects%2Fhome')).to.equal('/#/projects/home')
  })

  it('prefers the one the server appended, since that is how the browser got here', () => {
    chai.expect(readNextParam('?next=%2Fadmin%2F', '?next=%2F%23%2Fprojects%2Fhome')).to.equal('/admin/')
  })

  it('answers nothing when neither has one', () => {
    chai.expect(readNextParam('', '')).to.equal(null)
    chai.expect(readNextParam('?ff_authRedesignEnabled=true', '?foo=bar')).to.equal(null)
  })
})

describe('resolveNextRoute', () => {
  it('answers nothing when there is nothing to go to', () => {
    chai.expect(resolveNextRoute(null, origin)).to.equal(null)
    chai.expect(resolveNextRoute('', origin)).to.equal(null)
  })

  it('reads a hash route of ours', () => {
    chai.expect(resolveNextRoute('/#/projects/home', origin)).to.equal('/projects/home')
  })

  it('keeps the query string that lives inside the fragment', () => {
    chai.expect(resolveNextRoute('/#/forms/aXyZ/data/table?page=3', origin)).to.equal('/forms/aXyZ/data/table?page=3')
  })

  it('reads a hash route on a prefixed deployment', () => {
    const prefixed = { origin: 'https://kf.kobotoolbox.org', pathname: '/kpi/' }
    chai.expect(resolveNextRoute('/kpi/#/projects/home', prefixed)).to.equal('/projects/home')
  })

  // Django sends unauthenticated staff to the login page with `next=/admin/`, and the API browser does the same.
  it('drops a same-origin path that is not a route of ours', () => {
    chai.expect(resolveNextRoute('/admin/', origin)).to.equal(null)
    chai.expect(resolveNextRoute('/api/v2/assets/?format=json', origin)).to.equal(null)
    chai.expect(resolveNextRoute('https://kf.kobotoolbox.org/admin/', origin)).to.equal(null)
    chai.expect(resolveNextRoute('/admin/auth/user/#/projects/home', origin)).to.equal(null)
  })

  it('refuses another origin, so the login screen cannot bounce anybody off it', () => {
    chai.expect(resolveNextRoute('https://evil.example/phish', origin)).to.equal(null)
  })

  it('refuses another origin even when it carries a convincing hash route', () => {
    chai.expect(resolveNextRoute('https://evil.example/#/projects/home', origin)).to.equal(null)
  })

  it('refuses a protocol-relative URL, which reads as a path but is not one', () => {
    chai.expect(resolveNextRoute('//evil.example/phish', origin)).to.equal(null)
  })

  it('refuses a scheme with no origin of its own', () => {
    chai.expect(resolveNextRoute('javascript:alert(document.cookie)', origin)).to.equal(null)
    chai.expect(resolveNextRoute('data:text/html,<script>alert(1)</script>', origin)).to.equal(null)
  })

  it('refuses a same-origin URL dressed up with credentials for another host', () => {
    chai.expect(resolveNextRoute('https://kf.kobotoolbox.org@evil.example/phish', origin)).to.equal(null)
  })

  it('refuses something that is not a URL at all', () => {
    chai.expect(resolveNextRoute('http://', origin)).to.equal(null)
  })
})

describe('getUrlForNextRoute', () => {
  it('sends a route back through the fragment, since the app has to boot either way', () => {
    chai.expect(getUrlForNextRoute('/projects/home')).to.equal('/#/projects/home')
  })

  it('falls back to the site root, which is what signing in has always done', () => {
    chai.expect(getUrlForNextRoute(null)).to.equal('/')
  })
})

describe('getRouteWithNext', () => {
  it('carries where we are, written the way the server-rendered login page also understands', () => {
    chai
      .expect(getRouteWithNext(AUTH_ROUTES.LOGIN, '/projects/home'))
      .to.equal(`${AUTH_ROUTES.LOGIN}?next=%2F%23%2Fprojects%2Fhome`)
  })

  it('carries the query string too, since that is half of what made it that page', () => {
    chai
      .expect(getRouteWithNext(ACCOUNT_AUTH_ROUTES.REAUTHENTICATE, '/forms/aXyZ/data/table?page=3'))
      .to.equal(`${ACCOUNT_AUTH_ROUTES.REAUTHENTICATE}?next=%2F%23%2Fforms%2FaXyZ%2Fdata%2Ftable%3Fpage%3D3`)
  })

  it('carries nothing when there is nowhere to come back to', () => {
    chai.expect(getRouteWithNext(AUTH_ROUTES.LOGIN, null)).to.equal(AUTH_ROUTES.LOGIN)
    chai.expect(getRouteWithNext(AUTH_ROUTES.LOGIN, '')).to.equal(AUTH_ROUTES.LOGIN)
  })

  it('never points back at the screen it is sending somebody to', () => {
    chai.expect(getRouteWithNext(AUTH_ROUTES.LOGIN, AUTH_ROUTES.LOGIN)).to.equal(AUTH_ROUTES.LOGIN)
  })

  it('never points back at another authentication screen either', () => {
    chai.expect(getRouteWithNext(AUTH_ROUTES.LOGIN, AUTH_ROUTES.SIGNUP)).to.equal(AUTH_ROUTES.LOGIN)
    chai
      .expect(getRouteWithNext(AUTH_ROUTES.LOGIN, ACCOUNT_AUTH_ROUTES.REAUTHENTICATE_TOTP))
      .to.equal(AUTH_ROUTES.LOGIN)
  })

  // Only the reauthentication screens under `/account` count as authentication screens; the settings pages around them
  // are ordinary destinations.
  it('carries an account settings page, which is not an authentication screen', () => {
    chai
      .expect(getRouteWithNext(ACCOUNT_AUTH_ROUTES.REAUTHENTICATE, ACCOUNT_AUTH_ROUTES.MFA))
      .to.equal(`${ACCOUNT_AUTH_ROUTES.REAUTHENTICATE}?next=%2F%23%2Faccount%2F2fa`)
  })
})

describe('getLoginRouteWithNext', () => {
  it('is the login screen, with where we are attached', () => {
    chai.expect(getLoginRouteWithNext('/projects/home')).to.equal(`${AUTH_ROUTES.LOGIN}?next=%2F%23%2Fprojects%2Fhome`)
  })

  it('is the bare login screen when there is nothing worth coming back to', () => {
    chai.expect(getLoginRouteWithNext(null)).to.equal(AUTH_ROUTES.LOGIN)
  })
})
