import type { ExportSettingSettings } from '#/dataInterface'
import { ExportTypeName } from './exportsConstants'
import { preserveApiOnlySettings } from './exportsUtils'

function buildSettings(overrides: Partial<ExportSettingSettings> = {}): ExportSettingSettings {
  return {
    lang: '_default',
    type: ExportTypeName.geojson,
    fields: [],
    group_sep: '/',
    multiple_select: 'both',
    hierarchy_in_labels: false,
    fields_from_all_versions: true,
    query: {},
    ...overrides,
  }
}

describe('preserveApiOnlySettings', () => {
  it('keeps settings the form knows nothing about', () => {
    const merged = preserveApiOnlySettings(
      buildSettings(),
      buildSettings({ submission_ids: [1, 2, 3], some_future_setting: 'foo' }),
    )

    chai.expect(merged.submission_ids).to.deep.equal([1, 2, 3])
    chai.expect(merged.some_future_setting).to.equal('foo')
  })

  it('does not bring back `flatten` when a GeoJSON export is followed by a KML one', () => {
    const merged = preserveApiOnlySettings(
      buildSettings({ type: ExportTypeName.kml }),
      buildSettings({ type: ExportTypeName.geojson, flatten: true }),
    )

    chai.expect(merged).to.not.have.property('flatten')
  })

  it('does not bring back other export type specific settings', () => {
    const merged = preserveApiOnlySettings(
      buildSettings({ type: ExportTypeName.kml }),
      buildSettings({ type: ExportTypeName.xls, xls_types_as_text: true, include_media_url: true }),
    )

    chai.expect(merged).to.not.have.property('xls_types_as_text')
    chai.expect(merged).to.not.have.property('include_media_url')
  })

  it('does not overwrite settings coming from the form', () => {
    const merged = preserveApiOnlySettings(
      buildSettings({ type: ExportTypeName.csv, group_sep: ':', include_media_url: false }),
      buildSettings({ type: ExportTypeName.geojson, group_sep: '/', include_media_url: true }),
    )

    chai.expect(merged.type).to.equal(ExportTypeName.csv)
    chai.expect(merged.group_sep).to.equal(':')
    chai.expect(merged.include_media_url).to.equal(false)
  })

  it('does not mutate the given settings', () => {
    const formSettings = buildSettings()
    const savedSettings = buildSettings({ submission_ids: [1] })

    preserveApiOnlySettings(formSettings, savedSettings)

    chai.expect(formSettings).to.not.have.property('submission_ids')
  })
})
