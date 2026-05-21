// Jest needs the mock to be defined before any imports. And we use `var` to avoid Jest hoisting issues - it ensures
// the variable is available when the mock factory runs, preventing ReferenceError from happening.
var mockedActions: any
jest.mock('#/actions', () => {
  // Keep the mock small. Pulling in the real actions module would drag unrelated Reflux setup
  // into a test that only cares about bridge routing.
  mockedActions = {
    reports: {
      setStyle: { completed: jest.fn(), failed: jest.fn() },
      setCustom: { completed: jest.fn(), failed: jest.fn() },
    },
    resources: {
      updateAsset: { completed: jest.fn(), failed: jest.fn() },
      createResource: { completed: jest.fn(), failed: jest.fn() },
      cloneAsset: { completed: jest.fn(), failed: jest.fn() },
      deleteAsset: { completed: jest.fn(), failed: jest.fn() },
      deployAsset: { completed: jest.fn(), failed: jest.fn() },
      setDeploymentActive: { completed: jest.fn(), failed: jest.fn() },
    },
    map: {
      setMapStyles: { started: jest.fn(), completed: jest.fn(), failed: jest.fn() },
    },
  }
  return { actions: mockedActions }
})

import chai from 'chai'
import {
  bridgeOrvalFailureToLegacyActions,
  bridgeOrvalStartToLegacyActions,
  bridgeOrvalSuccessToLegacyActions,
} from './index'
import { doesEndpointMatchHandler } from './shared'

describe('reflux bridge handler flow', () => {
  beforeEach(() => {
    // Start each test from a clean slate so the assertions stay local.
    jest.clearAllMocks()
  })

  it('dispatches started, completed and failed map style actions for PATCH /assets/:uid/', () => {
    // One real request shape gives more confidence here than a pile of tiny helper tests.
    // This PATCH goes through all three bridge phases.
    const url = '/api/v2/assets/abc123/'
    const mapStyles = { selectedQuestion: 'q1' }
    const config = {
      method: 'PATCH' as const,
      body: JSON.stringify({ map_styles: mapStyles }),
    }

    // Legacy listeners expect `started` before the request goes out.
    bridgeOrvalStartToLegacyActions(url, config)

    const successAsset = {
      uid: 'abc123',
      map_styles: mapStyles,
    }

    // A successful response should hit the matching `.completed` actions.
    bridgeOrvalSuccessToLegacyActions(url, config, {
      data: successAsset,
      status: 200,
      headers: new Headers(),
    })

    // Failed responses are reshaped to look like the old failure payloads.
    bridgeOrvalFailureToLegacyActions(url, config, {
      error: new Error('fail'),
      data: { detail: 'broken map style' },
      status: 400,
      headers: new Headers(),
    })

    const mapActions = mockedActions.map.setMapStyles as unknown as {
      started: jest.Mock
      completed: jest.Mock
      failed: jest.Mock
    }

    const resourceActions = mockedActions.resources as unknown as {
      updateAsset: { completed: jest.Mock }
    }

    const reportActions = mockedActions.reports as unknown as {
      setStyle: { completed: jest.Mock }
      setCustom: { completed: jest.Mock }
    }

    // This is the contract we care about for `map_styles` PATCH requests.
    chai.expect(mapActions.started.mock.calls).to.deep.equal([['abc123', mapStyles]])
    chai.expect(mapActions.completed.mock.calls).to.deep.equal([[successAsset]])
    chai.expect(mapActions.failed.mock.calls.length).to.equal(1)

    // Check only the parts that matter for legacy listeners here.
    const failedPayload = mapActions.failed.mock.calls[0][0]
    chai.expect(failedPayload.status).to.equal(400)
    chai.expect(failedPayload.statusText).to.equal('error')
    chai.expect(failedPayload.responseJSON).to.deep.equal({ detail: 'broken map style' })

    chai.expect(resourceActions.updateAsset.completed.mock.calls).to.deep.equal([[successAsset]])

    // Make sure this request did not spill into report-related handlers.
    chai.expect(reportActions.setStyle.completed.mock.calls.length).to.equal(0)
    chai.expect(reportActions.setCustom.completed.mock.calls.length).to.equal(0)
  })
})

describe('endpoint pattern matching', () => {
  it('matches dynamic asset endpoint pattern', () => {
    chai
      .expect(doesEndpointMatchHandler('PATCH /api/v2/assets/:uid/', 'PATCH', '/api/v2/assets/abc123/'))
      .to.equal(true)
  })

  it('does not match a different path shape', () => {
    chai
      .expect(doesEndpointMatchHandler('PATCH /api/v2/assets/:uid/', 'PATCH', '/api/v2/assets/abc123/deployment/'))
      .to.equal(false)
  })

  it('does not match when method differs', () => {
    chai
      .expect(doesEndpointMatchHandler('PATCH /api/v2/assets/:uid/', 'POST', '/api/v2/assets/abc123/'))
      .to.equal(false)
  })
})
