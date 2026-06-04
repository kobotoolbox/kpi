import { buildMapSettingsTabsToDisplay } from './MapSettings'

describe('buildMapSettingsTabsToDisplay', () => {
  it('keeps baseline tabs when no extra tab conditions are met', () => {
    const tabs = buildMapSettingsTabsToDisplay({
      hasMultipleGeopointQuestions: false,
      hasLargeQueryCount: false,
    })

    chai.expect(tabs).to.deep.equal(['overlays', 'colors'])
  })

  it('includes query limit without removing overlays', () => {
    const tabs = buildMapSettingsTabsToDisplay({
      hasMultipleGeopointQuestions: false,
      hasLargeQueryCount: true,
    })

    chai.expect(tabs).to.deep.equal(['querylimit', 'overlays', 'colors'])
  })

  it('includes geopoint question without removing overlays', () => {
    const tabs = buildMapSettingsTabsToDisplay({
      hasMultipleGeopointQuestions: true,
      hasLargeQueryCount: false,
    })

    chai.expect(tabs).to.deep.equal(['geoquestion', 'overlays', 'colors'])
  })

  it('includes query limit and geopoint question together without removing overlays', () => {
    const tabs = buildMapSettingsTabsToDisplay({
      hasMultipleGeopointQuestions: true,
      hasLargeQueryCount: true,
    })

    chai.expect(tabs).to.deep.equal(['querylimit', 'geoquestion', 'overlays', 'colors'])
  })

  it('still keeps overlays tab when the user cannot change the asset', () => {
    const tabs = buildMapSettingsTabsToDisplay({
      hasMultipleGeopointQuestions: true,
      hasLargeQueryCount: true,
    })

    chai.expect(tabs).to.deep.equal(['querylimit', 'geoquestion', 'overlays', 'colors'])
  })
})
