import alertify from 'alertifyjs'
import cx from 'classnames'
// Libraries
import React from 'react'
import Dropzone, { type FileWithPreview } from 'react-dropzone'

// Partial components
import bem from '../../../js/bem'
import Button from '../../../js/components/common/button'
import Modal from '../../../js/components/common/modal'
import MapColorPicker from '../../../js/components/map/MapColorPicker'

// Stores, hooks and utilities
import { actions } from '../../../js/actions'
import { getQuestionOrChoiceDisplayName, getRowName } from '../../../js/assetUtils'
import { userCan } from '../../../js/components/permissions/utils'
import { dataInterface } from '../../../js/dataInterface'
import { notify } from '../../../js/utils'

// Constants and types
import { ASSET_FILE_TYPES, QUERY_LIMIT_DEFAULT } from '../../../js/constants'
import type {
  AssetFileResponse,
  AssetMapStyles,
  AssetResponse,
  ColorSetName,
  FailResponse,
  LabelValuePair,
  PaginatedResponse,
} from '../../../js/dataInterface'

enum MapSettingsTabNames {
  colors = 'colors',
  querylimit = 'querylimit',
  geoquestion = 'geoquestion',
  overlays = 'overlays',
}

interface MapSettingsTabDefinition {
  id: MapSettingsTabNames
  label: string
}

const QUERY_LIMIT_MINIMUM = 1000
const QUERY_LIMIT_MAXIMUM = 30000
const TABS = new Map<MapSettingsTabNames, MapSettingsTabDefinition>([
  [MapSettingsTabNames.colors, { id: MapSettingsTabNames.colors, label: t('Marker Colors') }],
  [MapSettingsTabNames.querylimit, { id: MapSettingsTabNames.querylimit, label: t('Query Limit') }],
  [MapSettingsTabNames.geoquestion, { id: MapSettingsTabNames.geoquestion, label: t('Geopoint question') }],
  [MapSettingsTabNames.overlays, { id: MapSettingsTabNames.overlays, label: t('Overlays') }],
])

interface MapSettingsProps {
  asset: AssetResponse
  toggleMapSettings: () => void
  overrideStyles: (mapStyles: AssetMapStyles) => void
  overridenStyles?: AssetMapStyles
}

interface MapSettingsState {
  activeModalTab: MapSettingsTabNames
  geoQuestions: LabelValuePair[]
  mapSettings: AssetMapStyles
  files: AssetFileResponse[]
  layerName: string
  queryCount: number
}

export default class MapSettings extends React.Component<MapSettingsProps, MapSettingsState> {
  private unlisteners: Function[] = []

  constructor(props: MapSettingsProps) {
    super(props)

    const geoQuestions: LabelValuePair[] = []
    props.asset.content?.survey?.forEach((question: any) => {
      if (question.type && question.type === 'geopoint') {
        geoQuestions.push({
          value: getRowName(question),
          label: getQuestionOrChoiceDisplayName(question, 0),
        })
      }
    })

    const queryCount = props.asset.deployment__submission_count

    let defaultActiveTab = MapSettingsTabNames.colors
    if (queryCount > QUERY_LIMIT_MINIMUM) {
      defaultActiveTab = MapSettingsTabNames.querylimit
    } else if (geoQuestions.length > 1) {
      defaultActiveTab = MapSettingsTabNames.geoquestion
    } else if (userCan('change_asset', this.props.asset)) {
      defaultActiveTab = MapSettingsTabNames.overlays
    }

    const mapStyles = Object.assign({}, this.props.asset.map_styles)
    if (this.props.overridenStyles) {
      Object.assign(mapStyles, this.props.overridenStyles)
    }

    // Force first geopoint question to be selected if there otherwise would be none
    if (!mapStyles.selectedQuestion) {
      const firstGeopoint = props.asset.content?.survey?.find(
        (question) => question.type && question.type === 'geopoint',
      )
      // Can only fail if this component somehow does not get the survey
      if (firstGeopoint) {
        Object.assign(mapStyles, { selectedQuestion: getRowName(firstGeopoint) })
      }
    }

    this.state = {
      activeModalTab: defaultActiveTab,
      geoQuestions: geoQuestions,
      mapSettings: mapStyles,
      files: [],
      layerName: '',
      queryCount: queryCount,
    }
  }

  componentDidMount() {
    this.unlisteners.push(actions.resources.getAssetFiles.completed.listen(this.onGetAssetFilesCompleted.bind(this)))
    actions.resources.getAssetFiles(this.props.asset.uid, ASSET_FILE_TYPES.map_layer.id)
  }

  componentWillUnmount(): void {
    this.unlisteners.forEach((unlisten) => unlisten())
  }

  // modal handling

  switchTab(newActiveTab: MapSettingsTabNames) {
    this.setState({ activeModalTab: newActiveTab })
  }

  resetMapSettings() {
    this.saveMapSettings({})
  }

  onSave() {
    this.saveMapSettings(this.state.mapSettings)
  }

  saveMapSettings(newSettings: AssetMapStyles) {
    const assetUid = this.props.asset.uid
    if (userCan('change_asset', this.props.asset)) {
      actions.map.setMapStyles(assetUid, newSettings)
    } else {
      // pass settings to parent component directly
      // for users with no permission to edit asset
      this.props.overrideStyles(newSettings)
    }
    this.props.toggleMapSettings()
  }

  // user input handling

  onGeoPointQuestionChange(evt: React.ChangeEvent<HTMLInputElement>) {
    const settings = this.state.mapSettings
    settings.selectedQuestion = evt.target.value
    this.setState({ mapSettings: settings })
  }

  onQueryLimitChange(evt: React.ChangeEvent<HTMLInputElement>) {
    const settings = this.state.mapSettings
    settings.querylimit = evt.target.value
    this.setState({ mapSettings: settings })
  }

  onColorChange(newVal: ColorSetName) {
    const settings = this.state.mapSettings
    settings.colorSet = newVal
    this.setState({ mapSettings: settings })
  }

  onLayerNameChange(evt: React.ChangeEvent<HTMLInputElement>) {
    this.setState({ layerName: evt.target.value })
  }

  // handling files

  onGetAssetFilesCompleted(data: PaginatedResponse<AssetFileResponse>) {
    if (data.results) {
      this.setState({ files: data.results })
    }
  }

  dropFiles(files: FileWithPreview[], rejectedFiles: FileWithPreview[]) {
    const description = this.state.layerName

    if (!description) {
      notify.error(t('Please add a name for your layer file.'))
      return
    }

    files.map((file) => {
      const metadata = {
        type: file.name.split('.').pop(),
        size: file.size,
      }
      const data = {
        content: file,
        description: description,
        file_type: 'map_layer',
        metadata: JSON.stringify(metadata),
      }
      dataInterface
        .uploadAssetFile(this.props.asset.uid, data)
        .done(() => {
          this.setState({ layerName: '' })
          actions.resources.getAssetFiles(this.props.asset.uid, 'map_layer')
        })
        .fail((error: FailResponse) => {
          var errMsg = t('Upload error: ##error_message##.').replace('##error_message##', error.statusText)
          notify.error(errMsg)
        })
    })

    rejectedFiles.map(() => {
      var errMsg = t('Upload error: not a valid map overlay format.')
      notify.error(errMsg)
    })
  }

  deleteFile(fileUid: string) {
    const dialog = alertify.dialog('confirm')

    const message =
      t('Are you sure you want to delete this file?') +
      '<br/><br/><strong>' +
      t('This action cannot be undone.') +
      '</strong>'

    const opts = {
      title: t('Delete File'),
      message: message,
      labels: { ok: t('Delete'), cancel: t('Cancel') },
      onok: () => {
        dataInterface.deleteAssetFile(this.props.asset.uid, fileUid).done(() => {
          actions.resources.getAssetFiles(this.props.asset.uid, 'map_layer')
          dialog.destroy()
        })
      },
      oncancel: () => {
        dialog.destroy()
      },
    }
    dialog.set(opts).show()
  }

  render() {
    const queryLimit = this.state.mapSettings.querylimit || QUERY_LIMIT_DEFAULT

    const tabsToDisplay = [MapSettingsTabNames.colors]
    if (userCan('change_asset', this.props.asset)) {
      tabsToDisplay.unshift(MapSettingsTabNames.overlays)
    }
    if (this.state.geoQuestions.length > 1) {
      tabsToDisplay.unshift(MapSettingsTabNames.geoquestion)
    }
    if (this.state.queryCount > QUERY_LIMIT_MINIMUM) {
      tabsToDisplay.unshift(MapSettingsTabNames.querylimit)
    }

    var modalTabs = tabsToDisplay.map((tabId, i) => (
      <button
        className={cx({
          'legacy-modal-tab-button': true,
          'legacy-modal-tab-button--active': this.state.activeModalTab === tabId,
        })}
        onClick={() => this.switchTab(tabId)}
        key={i}
      >
        {TABS.get(tabId)?.label || '??'}
      </button>
    ))

    return (
      <bem.GraphSettings>
        <Modal.Tabs>{modalTabs}</Modal.Tabs>
        <Modal.Body>
          <div className='tabs-content map-settings'>
            {this.state.activeModalTab === MapSettingsTabNames.geoquestion && (
              <div className='map-settings__GeoQuestions'>
                <p>{t('Choose the Geopoint question you would like to display on the map:')}</p>
                {this.state.geoQuestions.map((question, i) => (
                  <label htmlFor={'GeopointQuestion-' + i} key={i}>
                    <input
                      type='radio'
                      name='trnsltn'
                      value={question.value}
                      onChange={this.onGeoPointQuestionChange.bind(this)}
                      checked={this.state.mapSettings.selectedQuestion === question.value ? true : false}
                      id={'GeopointQuestion-' + i}
                    />
                    {question.label}
                  </label>
                ))}
              </div>
            )}
            {this.state.activeModalTab === MapSettingsTabNames.overlays && (
              <div className='map-settings__overlay'>
                {this.state.files.length > 0 && (
                  <bem.FormModal__item m='list-files'>
                    <label>{t('Uploaded layers')}</label>
                    {this.state.files.map((file, i) => (
                      <div className='list-file-row' key={i}>
                        <span className='file-type'>{file.metadata.type}</span>
                        <span className='file-layer-name'>{file.description}</span>
                        <span
                          className='file-delete'
                          onClick={() => this.deleteFile(file.uid)}
                          data-tip={t('Delete layer')}
                        >
                          <i className='k-icon k-icon-trash' />
                        </span>
                      </div>
                    ))}
                  </bem.FormModal__item>
                )}
                <bem.FormModal__item m='layer-upload'>
                  <label htmlFor='name'>
                    {t(
                      'Use the form below to upload files with map data in one of these formats: CSV, KML, KMZ, WKT or GEOJSON. The data will be made available as layers for display on the map.',
                    )}
                  </label>
                  <input
                    type='text'
                    id='name'
                    placeholder={t('Layer name')}
                    value={this.state.layerName}
                    onChange={this.onLayerNameChange.bind(this)}
                  />
                  <Dropzone
                    onDrop={this.dropFiles.bind(this)}
                    multiple={false}
                    className='dropzone'
                    accept={'.csv,.kml,.geojson,.wkt,.json,.kmz'}
                  >
                    <Button type='primary' size='l' label={t('Upload')} isFullWidth />
                  </Dropzone>
                </bem.FormModal__item>
              </div>
            )}
            {this.state.activeModalTab === MapSettingsTabNames.colors && (
              <bem.FormModal__item>
                <div className='map-settings__colors'>
                  {t('Choose the color set for the disaggregated map markers.')}
                  <MapColorPicker onChange={this.onColorChange.bind(this)} mapSettings={this.state.mapSettings} />
                </div>
              </bem.FormModal__item>
            )}
            {this.state.activeModalTab === MapSettingsTabNames.querylimit && (
              <bem.FormModal__item>
                <div className='map-settings__querylimit'>
                  {t(
                    'By default the map is limited to the ##QUERY_LIMIT_DEFAULT## most recent submissions. You can temporarily increase this limit to a different value. Note that this is reset whenever you reopen the map.',
                  ).replace('##QUERY_LIMIT_DEFAULT##', String(QUERY_LIMIT_DEFAULT))}
                  <p className='change-limit-warning'>
                    Warning: Displaying a large number of points requires a lot of memory.
                  </p>
                  <form className='change-limit-form'>
                    <input
                      id='limit-slider'
                      className='change-limit-slider'
                      type='range'
                      step={QUERY_LIMIT_MINIMUM}
                      min={QUERY_LIMIT_MINIMUM}
                      max={QUERY_LIMIT_MAXIMUM}
                      value={queryLimit}
                      onChange={this.onQueryLimitChange.bind(this)}
                    />
                    <output id='limit-slider-value' className='change-limit-slider-value' htmlFor='limit-slider'>
                      {queryLimit}
                    </output>
                  </form>
                </div>
              </bem.FormModal__item>
            )}
          </div>
        </Modal.Body>

        {[MapSettingsTabNames.geoquestion, MapSettingsTabNames.colors, MapSettingsTabNames.querylimit].includes(
          this.state.activeModalTab,
        ) && (
          <bem.Modal__footer>
            {userCan('change_asset', this.props.asset) && queryLimit !== QUERY_LIMIT_DEFAULT && (
              <Button type='danger' size='l' onClick={this.resetMapSettings.bind(this)} label={t('Reset')} />
            )}

            <Button type='primary' size='l' onClick={this.onSave.bind(this)} label={t('Save')} />
          </bem.Modal__footer>
        )}
      </bem.GraphSettings>
    )
  }
}
