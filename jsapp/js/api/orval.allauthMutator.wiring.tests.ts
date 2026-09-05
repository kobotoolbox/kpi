// Guards that allauth-tagged endpoints use fetchAllauth and not fetchWithAuth.
// If the OpenAPI tag name changes and orval is re-run without updating
// orval.config.js, the generated file reverts to fetchWithAuth and this fails.

var mockedFetchAllauth: jest.Mock

jest.mock('./orval.allauthMutator', () => {
  mockedFetchAllauth = jest.fn().mockResolvedValue({ status: 200, data: {}, headers: new Headers() })
  return { fetchAllauth: mockedFetchAllauth, default: mockedFetchAllauth }
})

jest.mock('#/utils', () => {
  return { getCsrfToken: jest.fn().mockReturnValue(null) }
})

import { allauthBrowserV1AuthSessionGet } from '#/api/react-query/authentication-allauth-headless'

describe('allauth mutator wiring', () => {
  it('allauth hooks call fetchAllauth', async () => {
    await allauthBrowserV1AuthSessionGet()

    chai.expect(mockedFetchAllauth.mock.calls).to.have.length(1)
  })
})
