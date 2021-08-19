import React from 'react';
import reactMixin from 'react-mixin';
import Reflux from 'reflux';
import bem from 'js/bem';
import Modal from 'js/components/common/modal';
import autoBind from 'react-autobind';
import {actions} from '../actions';
import mixins from '../mixins';
import Dropzone from 'react-dropzone';
import alertify from 'alertifyjs';
import {
  QUERY_LIMIT_DEFAULT,
  ASSET_FILE_TYPES,
} from 'js/constants';
import { dataInterface } from '../dataInterface';

// see kobo.map.marker-colors.scss for styling details of each set
const COLOR_SETS = ['a', 'b', 'c', 'd', 'e'];
const QUERY_LIMIT_MINIMUM = 1000;
const QUERY_LIMIT_MAXIMUM = 30000;
const TABS = new Map([
  ['colors', {id: 'colors', label: t('Marker Colors')}],
  ['querylimit', {id: 'querylimit', label: t('Query Limit')}],
  ['geoquestion', {id: 'geoquestion', label: t('Geopoint question')}],
  ['overlays', {id: 'overlays', label: t('Overlays')}]
]);

class MapColorPicker extends React.Component {
  constructor(props) {
    super(props);
    autoBind(this);

    this.state = {
      selected: props.mapSettings.colorSet ? props.mapSettings.colorSet : 'a'
    };
  }

  onChange (e) {
    this.props.onChange(e.currentTarget.value);
    this.setState({
      selected: e.currentTarget.value
    });
  }

  defaultValue (set) {
    return this.state.selected === set;
  }

  colorRows(set, length = 10) {
    let colorRows = [];
    for (let i = 1; i < length; i++) {
      colorRows.push(<span key={i} className={`map-marker map-marker-${set}${i}`} />);
    }
    return colorRows;
  }

  render () {
    var radioButtons = COLOR_SETS.map(function(set, index){
      var length = 10;
      var label = false;
      if (set === 'a') {length = 16;}
      if (set === 'a') {label = t('Best for qualitative data');}
      if (set === 'b') {label = t('Best for sequential data');}
      if (set === 'd') {label = t('Best for diverging data');}
      return (
        <bem.FormModal__item m='map-color-item' key={index}>
          {label &&
            <label>{label}</label>
          }
          <bem.GraphSettings__radio>
            <input type='radio' name='chart_colors'
              value={set}
              checked={this.defaultValue(set)}
              onChange={this.onChange}
              id={'c-' + index} />
            <label htmlFor={'c-' + index}>
              {this.colorRows(set, length)}
            </label>
          </bem.GraphSettings__radio>
        </bem.FormModal__item>

      );
    }, this);

    return (
      <bem.GraphSettings__colors>{radioButtons}</bem.GraphSettings__colors>
    );
  }
}

class MapSettings extends React.Component {
  constructor(props) {
    super(props);
    autoBind(this);

    const geoQuestions = [];
    props.asset.content.survey.forEach(function(question) {
      if (question.type && question.type === 'geopoint') {
        geoQuestions.push({
          value: question.name || question.$autoname,
          label: question.label[0]
        });
      }
    });

    const queryCount = props.asset.deployment__submission_count;

    let defaultActiveTab = TABS.get('colors').id;
    if (queryCount > QUERY_LIMIT_MINIMUM) {
      defaultActiveTab = TABS.get('querylimit').id;
    } else if (geoQuestions.length > 1) {
      defaultActiveTab = TABS.get('geoquestion').id;
    } else if (this.userCan('change_asset', this.props.asset)) {
      defaultActiveTab = TABS.get('overlays').id;
    }

    let mapStyles = Object.assign({}, this.props.asset.map_styles);
    if (this.props.overridenStyles) {
      Object.assign(mapStyles, this.props.overridenStyles);
    }

    this.state = {
      activeModalTab: defaultActiveTab,
      geoQuestions: geoQuestions,
      mapSettings: mapStyles,
      files: [],
      layerName: '',
      queryCount: queryCount
    };
  }

  componentDidMount() {
    actions.resources.getAssetFiles(this.props.asset.uid, ASSET_FILE_TYPES.map_layer.id);
    this.listenTo(actions.resources.getAssetFiles.completed, this.updateFileList);
  }

  // modal handling

  switchTab(evt) {
    this.setState({activeModalTab: evt.target.getAttribute('data-tabid')});
  }

  resetMapSettings() {
    this.saveMapSettings({});
  }

  onSave() {
    this.saveMapSettings(this.state.mapSettings);
  }

  saveMapSettings(newSettings) {
    let assetUid = this.props.asset.uid;
    if (this.userCan('change_asset', this.props.asset)) {
      actions.map.setMapStyles(assetUid, newSettings);
    } else {
      // pass settings to parent component directly
      // for users with no permission to edit asset
      this.props.overrideStyles(newSettings);
    }
    this.props.toggleMapSettings();
  }

  // user input handling

  onGeoPointQuestionChange(evt) {
    let settings = this.state.mapSettings;
    settings.selectedQuestion = evt.target.value;
    this.setState({ mapSettings: settings });
  }

  onQueryLimitChange(evt) {
    let settings = this.state.mapSettings;
    settings.querylimit = evt.target.value;
    this.setState({ mapSettings: settings });
  }

  onColorChange(val) {
    let settings = this.state.mapSettings;
    settings.colorSet = val;
    this.setState({ mapSettings: settings });
  }

  onLayerNameChange(e) {
    this.setState({ layerName: e.target.value });
  }

  // handling files

  updateFileList(data) {
    if (data.results) {
      this.setState({ files: data.results });
    }
  }

  dropFiles(files, rejectedFiles) {
    let uid = this.props.asset.uid,
      _this = this,
      description = this.state.layerName;

    if (!description) {
      alertify.error(t('Please add a name for your layer file.'));
      return false;
    }

    files.map((file) => {
      let metadata = {
        type: file.name.split('.').pop(),
        size: file.size
      };
      let data = {
        content: file,
        description: description,
        file_type: 'map_layer',
        metadata: JSON.stringify(metadata)
      };
      dataInterface.uploadAssetFile(uid, data).done(() => {
        _this.setState({ layerName: '' });
        actions.resources.getAssetFiles(this.props.asset.uid, 'map_layer');
      }).fail((jqxhr) => {
        var errMsg = t('Upload error: ##error_message##.').replace('##error_message##', jqxhr.statusText);
        alertify.error(errMsg);
      });
    });

    rejectedFiles.map(() => {
      var errMsg = t('Upload error: not a valid map overlay format.');
      alertify.error(errMsg);
    });
  }

  deleteFile(evt) {
    let el = $(evt.target)
        .closest('[data-uid]')
        .get(0),
      uid = el.getAttribute('data-uid'),
      dialog = alertify.dialog('confirm');

    let opts = {
      title: t('Delete File'),
      message: t(
        'Are you sure you want to delete this file? ' +
          '<br/><br/><strong>This action cannot be undone.</strong>'
      ),
      labels: { ok: t('Delete'), cancel: t('Cancel') },
      onok: () => {
        dataInterface.deleteAssetFile(this.props.asset.uid, uid).done(() => {
          actions.resources.getAssetFiles(this.props.asset.uid, 'map_layer');
          dialog.destroy();
        });
      },
      oncancel: () => {
        dialog.destroy();
      }
    };
    dialog.set(opts).show();
  }

  render() {
    let asset = this.props.asset,
      geoQuestions = this.state.geoQuestions,
      activeTab = this.state.activeModalTab,
      queryLimit = this.state.mapSettings.querylimit || QUERY_LIMIT_DEFAULT,
      queryCount = this.state.queryCount;
    var tabs = [TABS.get('colors').id];

    if (this.userCan('change_asset', asset)) {tabs.unshift(TABS.get('overlays').id);}
    if (geoQuestions.length > 1) {tabs.unshift(TABS.get('geoquestion').id);}
    if (queryCount > QUERY_LIMIT_MINIMUM) {tabs.unshift(TABS.get('querylimit').id);}

    var modalTabs = tabs.map(function(tabId, i) {
      return (
        <button
          className={`mdl-button mdl-button--tab ${
            this.state.activeModalTab === tabId ? 'active' : ''
          }`}
          onClick={this.switchTab}
          data-tabid={tabId}
          key={i}
        >
          {TABS.get(tabId).label}
        </button>
      );
    }, this);
    return (
      <bem.GraphSettings>
        <Modal.Tabs>{modalTabs}</Modal.Tabs>
        <Modal.Body>
          <div className='tabs-content map-settings'>
            {activeTab === TABS.get('geoquestion').id && (
              <div className='map-settings__GeoQuestions'>
                <p>
                  {t(
                    'Choose the Geopoint question you would like to display on the map:'
                  )}
                </p>
                {geoQuestions.map((question, i) => {
                  return (
                    <label htmlFor={'GeopointQuestion-' + i} key={i}>
                      <input
                        type='radio'
                        name='trnsltn'
                        value={question.value}
                        onChange={this.onGeoPointQuestionChange}
                        checked={
                          this.state.mapSettings.selectedQuestion ===
                          question.value
                            ? true
                            : false
                        }
                        id={'GeopointQuestion-' + i}
                      />
                      {question.label}
                    </label>
                  );
                })}
              </div>
            )}
            {activeTab === TABS.get('overlays').id && (
              <div className='map-settings__overlay'>
                {this.state.files.length > 0 && (
                  <bem.FormModal__item m='list-files'>
                    <label>{t('Uploaded layers')}</label>
                    {this.state.files.map((file, i) => {
                      return (
                        <div className='list-file-row' key={i}>
                          <span className='file-type'>
                            {file.metadata.type}
                          </span>
                          <span className='file-layer-name'>{file.description}</span>
                          <span
                            className='file-delete'
                            onClick={this.deleteFile}
                            data-tip={t('Delete layer')}
                            data-uid={file.uid}
                          >
                            <i className='k-icon k-icon-trash' />
                          </span>
                        </div>
                      );
                    })}
                  </bem.FormModal__item>
                )}
                <bem.FormModal__item m='layer-upload'>
                  <label htmlFor='name'>
                    {t('Use the form below to upload files with map data in one of these formats: CSV, KML, KMZ, WKT or GEOJSON. The data will be made available as layers for display on the map.')}
                  </label>
                  <input
                    type='text'
                    id='name'
                    placeholder={t('Layer name')}
                    value={this.state.layerName}
                    onChange={this.onLayerNameChange}
                  />
                  <Dropzone
                    onDrop={this.dropFiles}
                    multiple={false}
                    className='dropzone'
                    accept={'.csv,.kml,.geojson,.wkt,.json,.kmz'}
                  >
                    <bem.KoboButton m='blue'>
                      {t('Upload')}
                    </bem.KoboButton>
                  </Dropzone>
                </bem.FormModal__item>
              </div>
            )}
            {activeTab === TABS.get('colors').id && (
              <bem.FormModal__item>
                <div className='map-settings__colors'>
                  {t('Choose the color set for the disaggregated map markers.')}
                  <MapColorPicker onChange={this.onColorChange} mapSettings={this.state.mapSettings}/>
                </div>
              </bem.FormModal__item>
            )}
            {activeTab === TABS.get('querylimit').id && (
              <bem.FormModal__item>
                <div className='map-settings__querylimit'>
                  {t('By default the map is limited to the ##QUERY_LIMIT_DEFAULT## most recent submissions. You can temporarily increase this limit to a different value. Note that this is reset whenever you reopen the map.').replace('##QUERY_LIMIT_DEFAULT##', QUERY_LIMIT_DEFAULT)}
                  <p className='change-limit-warning'>Warning: Displaying a large number of points requires a lot of memory.</p>
                  <form>
                    <input
                      id='limit-slider'
                      className='change-limit-slider'
                      type='range'
                      step={QUERY_LIMIT_MINIMUM}
                      min={QUERY_LIMIT_MINIMUM}
                      max={QUERY_LIMIT_MAXIMUM}
                      value={queryLimit}
                      onChange={this.onQueryLimitChange
                    }/>
                    <output
                      id='limit-slider-value'
                      className='change-limit-slider-value'
                      htmlFor='limit-slider'
                    >{queryLimit}</output>
                  </form>
                </div>
              </bem.FormModal__item>
            )}
          </div>
        </Modal.Body>

        {[TABS.get('geoquestion').id, TABS.get('colors').id, TABS.get('querylimit').id].includes(activeTab) &&
          <bem.Modal__footer>
            {this.userCan('change_asset', this.props.asset) && queryLimit !== QUERY_LIMIT_DEFAULT &&
              <bem.KoboButton m='whitegray' onClick={this.resetMapSettings}>
                {t('Reset')}
              </bem.KoboButton>
            }
            <bem.KoboButton m='blue' onClick={this.onSave}>
              {t('Save')}
            </bem.KoboButton>
          </bem.Modal__footer>
        }
      </bem.GraphSettings>
    );
  }
}

reactMixin(MapSettings.prototype, Reflux.ListenerMixin);
reactMixin(MapSettings.prototype, mixins.permissions);

export default MapSettings;
