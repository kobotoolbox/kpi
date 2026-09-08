import { injectRouter } from '#/router/legacy'
import {
  getBackToCurrentScreen,
  getDataTablePath,
  getSubmissionLookupParams,
  getSubmissionNeighborParams,
  getSubmissionPath,
  goToSubmission,
} from './submissionRouting'

describe('submissionRouting', () => {
  const navigate = jest.fn()

  beforeEach(() => {
    navigate.mockClear()
    // Stands in for the app's router, so we can assert what we navigate to.
    injectRouter({ navigate } as unknown as Parameters<typeof injectRouter>[0])
  })

  describe('getSubmissionPath', () => {
    it('addresses a submission by its root UUID', () => {
      chai
        .expect(getSubmissionPath('aBcDeF', 'a1b2c3d4-1111-2222-3333-444455556666'))
        .to.equal('/forms/aBcDeF/data/submission/a1b2c3d4-1111-2222-3333-444455556666')
    })

    it('accepts a numeric id, for links made before submissions had an address', () => {
      chai.expect(getSubmissionPath('aBcDeF', 1234)).to.equal('/forms/aBcDeF/data/submission/1234')
    })
  })

  describe('getDataTablePath', () => {
    it('points at the project data table', () => {
      chai.expect(getDataTablePath('aBcDeF')).to.equal('/forms/aBcDeF/data/table')
    })
  })

  describe('goToSubmission', () => {
    it('navigates to the record', () => {
      goToSubmission('aBcDeF', 1234)

      chai.expect(navigate.mock.calls).to.have.lengthOf(1)
      chai.expect(navigate.mock.calls[0][0]).to.equal('/forms/aBcDeF/data/submission/1234')
    })

    it('passes on the route state, so a duplicate can explain itself', () => {
      goToSubmission('aBcDeF', 1234, { replace: true, state: { duplicatedFromUuid: 'abc' } })

      chai.expect(navigate.mock.calls[0][1]).to.deep.equal({
        replace: true,
        state: { duplicatedFromUuid: 'abc' },
      })
    })
  })

  describe('getBackToCurrentScreen', () => {
    /** Stands in for the app's router sitting on the given address. */
    const injectRouterAt = (pathname: string, search = '') => {
      injectRouter({ navigate, state: { location: { pathname, search } } } as unknown as Parameters<
        typeof injectRouter
      >[0])
    }

    it('captures the address as it stands, so returning restores the screen', () => {
      injectRouterAt('/forms/aBcDeF/data/map/Your_place')

      chai.expect(getBackToCurrentScreen('Back to Map')).to.deep.equal({
        path: '/forms/aBcDeF/data/map/Your_place',
        label: 'Back to Map',
      })
    })

    it('keeps the query string, for screens that store their state there', () => {
      injectRouterAt('/forms/aBcDeF/settings/rest/hAbCdE', '?page=2')

      chai
        .expect(getBackToCurrentScreen('Back to REST Service Logs')?.path)
        .to.equal('/forms/aBcDeF/settings/rest/hAbCdE?page=2')
    })
  })

  describe('getSubmissionLookupParams', () => {
    it('matches a root UUID against both places it can be stored', () => {
      // Submissions predating `meta/rootUuid` only have `_uuid`.
      const params = getSubmissionLookupParams('a1b2c3d4-1111-2222-3333-444455556666')

      chai.expect(params.limit).to.equal(1)
      chai.expect(JSON.parse(String(params.query))).to.deep.equal({
        $or: [
          { 'meta/rootUuid': 'uuid:a1b2c3d4-1111-2222-3333-444455556666' },
          { _uuid: 'a1b2c3d4-1111-2222-3333-444455556666' },
        ],
      })
    })

    it('matches a numeric id as the database key', () => {
      const params = getSubmissionLookupParams('1234')

      chai.expect(JSON.parse(String(params.query))).to.deep.equal({ _id: 1234 })
    })
  })

  describe('getSubmissionNeighborParams', () => {
    it('walks towards older submissions for "next"', () => {
      // Submissions are listed newest first, so the next one has a lower `_id`.
      const params = getSubmissionNeighborParams(1234, 'next')

      chai.expect(params.limit).to.equal(1)
      chai.expect(JSON.parse(String(params.query))).to.deep.equal({ _id: { $lt: 1234 } })
      chai.expect(JSON.parse(String(params.sort))).to.deep.equal({ _id: -1 })
    })

    it('walks towards newer submissions for "prev"', () => {
      const params = getSubmissionNeighborParams(1234, 'prev')

      chai.expect(JSON.parse(String(params.query))).to.deep.equal({ _id: { $gt: 1234 } })
      chai.expect(JSON.parse(String(params.sort))).to.deep.equal({ _id: 1 })
    })

    it('stays within the data table filters when given them', () => {
      const params = getSubmissionNeighborParams(1234, 'next', {
        Your_name: { $regex: 'ann', $options: 'i' },
      })

      chai.expect(JSON.parse(String(params.query))).to.deep.equal({
        $and: [{ Your_name: { $regex: 'ann', $options: 'i' } }, { _id: { $lt: 1234 } }],
      })
    })

    it('ignores an empty filter, rather than wrapping it', () => {
      const params = getSubmissionNeighborParams(1234, 'next', {})

      chai.expect(JSON.parse(String(params.query))).to.deep.equal({ _id: { $lt: 1234 } })
    })
  })
})
