import { injectRouter } from '#/router/legacy'
import {
  getBackToCurrentScreen,
  getDataTablePath,
  getSubmissionCounterLabel,
  getSubmissionListWindowParams,
  getSubmissionLookupParams,
  getSubmissionNeighborParams,
  getSubmissionPath,
  goToSubmission,
} from './submissionRouting'

describe('submissionRouting', () => {
  const navigate = jest.fn()

  /** Stands in for the app's router sitting on the given address. */
  const injectRouterAt = (pathname: string, search = '') => {
    injectRouter({ navigate, state: { location: { pathname, search } } } as unknown as Parameters<
      typeof injectRouter
    >[0])
  }

  beforeEach(() => {
    navigate.mockClear()
    // Stands in for the app's router, so we can assert what we navigate to.
    injectRouter({ navigate } as unknown as Parameters<typeof injectRouter>[0])
  })

  describe('getSubmissionPath', () => {
    it('addresses a submission by its root UUID', () => {
      chai
        .expect(getSubmissionPath('aBcDeF', 'a1b2c3d4-1111-2222-3333-444455556666'))
        .to.equal('/forms/aBcDeF/data/table/submission/a1b2c3d4-1111-2222-3333-444455556666')
    })

    it('accepts a numeric id, for links made before submissions had an address', () => {
      chai.expect(getSubmissionPath('aBcDeF', 1234)).to.equal('/forms/aBcDeF/data/table/submission/1234')
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
      chai.expect(navigate.mock.calls[0][0]).to.equal('/forms/aBcDeF/data/table/submission/1234')
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
  })

  describe('getSubmissionListWindowParams', () => {
    const position = {
      index: 30,
      filterQuery: { Your_name: { $regex: 'ann', $options: 'i' } },
      sort: [
        { id: 'Your_name', desc: false },
        { id: '_id', desc: true },
      ],
    }

    it('asks for the rows around the record, with the table filters and sort', () => {
      const params = getSubmissionListWindowParams(position)

      // Two either side: one for each neighbour, one more for a record that has shifted.
      chai.expect(params.start).to.equal(28)
      chai.expect(params.limit).to.equal(5)
      chai.expect(JSON.parse(String(params.query))).to.deep.equal({ Your_name: { $regex: 'ann', $options: 'i' } })
      chai.expect(JSON.parse(String(params.sort))).to.deep.equal({ Your_name: 1, _id: -1 })
    })

    it('starts at the top of the list for the first rows', () => {
      chai.expect(getSubmissionListWindowParams({ ...position, index: 0 })).to.include({ start: 0, limit: 3 })
      chai.expect(getSubmissionListWindowParams({ ...position, index: 1 })).to.include({ start: 0, limit: 4 })
    })

    it('sends no query for an unfiltered table, rather than an empty one', () => {
      chai.expect(getSubmissionListWindowParams({ ...position, filterQuery: {} }).query).to.equal(undefined)
    })
  })

  describe('getSubmissionCounterLabel', () => {
    it('shows the position among an exact total', () => {
      chai.expect(getSubmissionCounterLabel(2, 17, 5000)).to.equal('2 of 17')
    })

    it('shows a capped total as the count limit and more', () => {
      chai.expect(getSubmissionCounterLabel(2, 'many', 5000)).to.equal('2 of 5000+')
    })

    it('waits for the count limit before showing a capped total', () => {
      chai.expect(getSubmissionCounterLabel(2, 'many', undefined)).to.equal(undefined)
    })

    it('says so when counting timed out', () => {
      chai.expect(getSubmissionCounterLabel(2, 'unknown', 5000)).to.equal('2 of unknown')
    })

    it('shows nothing without a position, as the record could be anywhere', () => {
      chai.expect(getSubmissionCounterLabel(undefined, 'many', 5000)).to.equal(undefined)
    })
  })
})
