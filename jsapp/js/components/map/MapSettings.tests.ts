import { buildMapSettingsTabsToDisplay } from './MapSettings'

describe('buildMapSettingsTabsToDisplay', () => {
  it('keeps baseline tabs when no extra tab conditions are met', () => {
    const tabs = buildMapSettingsTabsToDisplay({
      hasMultipleGeopointQuestions: false,
      hasLargeQueryCount: false,
      hasChangeAssetPermission: true,
    })

    chai.expect(tabs).to.deep.equal(['colors', 'overlays'])
  })

  it('includes query limit without removing overlays', () => {
    const tabs = buildMapSettingsTabsToDisplay({
      hasMultipleGeopointQuestions: false,
      hasLargeQueryCount: true,
      hasChangeAssetPermission: true,
    })

    chai.expect(tabs).to.deep.equal(['colors', 'querylimit', 'overlays'])
  })

  it('includes geopoint question without removing overlays', () => {
    const tabs = buildMapSettingsTabsToDisplay({
      hasMultipleGeopointQuestions: true,
      hasLargeQueryCount: false,
      hasChangeAssetPermission: true,
    })

    chai.expect(tabs).to.deep.equal(['colors', 'geoquestion', 'overlays'])
  })

  it('includes query limit and geopoint question together without removing overlays', () => {
    const tabs = buildMapSettingsTabsToDisplay({
      hasMultipleGeopointQuestions: true,
      hasLargeQueryCount: true,
      hasChangeAssetPermission: true,
    })

    chai.expect(tabs).to.deep.equal(['colors', 'querylimit', 'geoquestion', 'overlays'])
  })

  it('hides overlays when user has no permission to edit project', () => {
    const tabs = buildMapSettingsTabsToDisplay({
      hasMultipleGeopointQuestions: true,
      hasLargeQueryCount: true,
      hasChangeAssetPermission: false,
    })

    chai.expect(tabs).to.deep.equal(['colors', 'querylimit', 'geoquestion'])
  })
})
