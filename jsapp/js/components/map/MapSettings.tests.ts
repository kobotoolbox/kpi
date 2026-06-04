import { buildMapSettingsTabsToDisplay } from './MapSettings'

describe('buildMapSettingsTabsToDisplay', () => {
  it('keeps baseline tabs when no extra tab conditions are met', () => {
    const tabs = buildMapSettingsTabsToDisplay({
      hasMultipleGeopointQuestions: false,
      hasLargeQueryCount: false,
    })

    chai.expect(tabs).to.deep.equal(['colors', 'overlays'])
  })

  it('includes query limit without removing overlays', () => {
    const tabs = buildMapSettingsTabsToDisplay({
      hasMultipleGeopointQuestions: false,
      hasLargeQueryCount: true,
    })

    chai.expect(tabs).to.deep.equal(['colors', 'querylimit', 'overlays'])
  })

  it('includes geopoint question without removing overlays', () => {
    const tabs = buildMapSettingsTabsToDisplay({
      hasMultipleGeopointQuestions: true,
      hasLargeQueryCount: false,
    })

    chai.expect(tabs).to.deep.equal(['colors', 'geoquestion', 'overlays'])
  })

  it('includes query limit and geopoint question together without removing overlays', () => {
    const tabs = buildMapSettingsTabsToDisplay({
      hasMultipleGeopointQuestions: true,
      hasLargeQueryCount: true,
    })

    chai.expect(tabs).to.deep.equal(['colors', 'querylimit', 'geoquestion', 'overlays'])
  })
})
