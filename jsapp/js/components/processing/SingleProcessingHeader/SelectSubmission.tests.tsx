import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import type { DataResponse } from '#/api/models/dataResponse'
import { themeKobo } from '#/theme'
import SelectSubmission from './SelectSubmission'

type NeighborCount = number | 'many' | 'unknown' | null

// `null` means there is no neighbor on that side (empty results)
let mockPrevCount: NeighborCount = null
let mockNextCount: NeighborCount = null

// Both neighbor queries go through `useAssetsDataList`, told apart by the `_id` operator: `$gt` is the previous
// (newer) submission, `$lt` the next (older) one. The `select` passed in is applied the way React Query would.
jest.mock('#/api/react-query/survey-data', () => ({
  getAssetsDataListQueryKey: () => [],
  useAssetsDataList: (_assetUid: string, params: { query: string }, options: { query: { select: Function } }) => {
    const count = params.query.includes('$gt') ? mockPrevCount : mockNextCount
    const response = {
      status: 200,
      data: {
        count: count ?? 0,
        results: count === null ? [] : [{ _id: 1, _uuid: 'neighbor' }],
      },
    }
    return { data: options.query.select(response), isPending: false }
  },
}))

const SUBMISSION = { _id: 5, _uuid: 'current' } as unknown as DataResponse

function renderSelectSubmission(prevCount: NeighborCount, nextCount: NeighborCount) {
  mockPrevCount = prevCount
  mockNextCount = nextCount
  return render(
    <MantineProvider theme={themeKobo}>
      <SelectSubmission assetUid='asset-1' submission={SUBMISSION} xpath='audio_q' hasUnsavedWork={false} />
    </MantineProvider>,
  )
}

function getPositionText() {
  return screen.queryByText('Item', { exact: false })?.parentElement?.textContent?.replace(/\u00a0/g, ' ')
}

describe('SelectSubmission', () => {
  it('shows the position when both counts are exact', () => {
    renderSelectSubmission(2, 7)

    chai.expect(getPositionText()).to.equal('Item 3 of 10')
  })

  it('shows the position at the ends of the list', () => {
    renderSelectSubmission(null, 4)

    chai.expect(getPositionText()).to.equal('Item 1 of 5')
  })

  for (const [prevCount, nextCount] of [
    ['many', 7],
    [2, 'many'],
    ['unknown', 7],
    [2, 'unknown'],
    [null, 'many'],
  ] as Array<[NeighborCount, NeighborCount]>) {
    it(`hides the position when a count is 'many' or 'unknown' (prev: ${prevCount}, next: ${nextCount})`, () => {
      renderSelectSubmission(prevCount, nextCount)

      chai.expect(getPositionText()).to.equal(undefined)
    })
  }
})
