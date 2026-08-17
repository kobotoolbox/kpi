import { injectRouter } from '#/router/legacy'
import {
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
})
