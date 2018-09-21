import $ from 'jquery';
import React from 'react';
import reactMixin from 'react-mixin';
import Reflux from 'reflux';
import Select from 'react-select';
import bem from '../bem';
import ui from '../ui';
import autoBind from 'react-autobind';
import actions from '../actions';
import mixins from '../mixins';
import Dropzone from 'react-dropzone';
import alertify from 'alertifyjs';

import { assign, t, validFileTypes } from '../utils';
import { dataInterface } from '../dataInterface';

let colorSets = ['a', 'b', 'c', 'd', 'e'];
// see kobo.map.marker-colors.scss for styling details of each set

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
    var radioButtons = colorSets.map(function(set, index){
      var length = 10;
      var label = false;
      if (set === 'a') length = 16;
      if (set === 'a') label = t('Best for qualitative data');
      if (set === 'b') label = t('Best for sequential data');
      if (set === 'd') label = t('Best for diverging data');
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
};

class MapSettings extends React.Component {
  constructor(props) {
    super(props);
    autoBind(this);

    var geoQuestions = [];

    props.asset.content.survey.forEach(function(question) {
      if (question.type && question.type === 'geopoint') {
        geoQuestions.push({
          value: question.name || question.$autoname,
          label: question.label[0]
        });
      }
    });

    let defaultActiveTab = 'colors';
    if (this.userCan('change_asset', this.props.asset)) defaultActiveTab = 'overlays';
    if (geoQuestions.length > 1) defaultActiveTab = 'geoquestion';

    this.state = {
      activeModalTab: defaultActiveTab,
      geoQuestions: geoQuestions,
      mapSettings: this.props.asset.map_styles,
      files: [],
      layerName: ''
    };
  }
  componentDidMount() {
    actions.resources.getAssetFiles(this.props.asset.uid);
    this.listenTo(
      actions.resources.getAssetFiles.completed,
      this.updateFileList
    );
  }
  toggleTab(evt) {
    var n = evt.target.getAttribute('data-tabname');
    this.setState({
      activeModalTab: n
    });
  }
  geoPointQuestionChange(evt) {
    let settings = this.state.mapSettings;
    settings.selectedQuestion = evt.target.value;
    this.setState({ mapSettings: settings });
  }
  resetMapSettings() {
    actions.map.setMapSettings(this.props.asset.uid, {});
    this.props.toggleMapSettings();
  }
  saveMapSettings() {
    let settings = this.state.mapSettings,
      assetUid = this.props.asset.uid;

    if (this.userCan('change_asset', this.props.asset)) {
      actions.map.setMapSettings(assetUid, settings);
    } else {
      // pass settings to parent component directly
      // for users with no permission to edit asset
      this.props.overrideStyles(settings);
    }
    this.props.toggleMapSettings();
  }
  updateFileList(data) {
    if (data.results) {
      this.setState({ files: data.results });
    }
  }
  dropFiles(files, rejectedFiles) {
    let uid = this.props.asset.uid,
      _this = this,
      name = this.state.layerName;

    if (!name) {
      alertify.error(t('Please add a name for your layer file.'));
      return false;
    }

    files.map(file => {
      let metadata = {
        type: file.name.split('.').pop(),
        size: file.size
      };
      let data = {
        content: file,
        name: name,
        file_type: 'map_layer',
        metadata: JSON.stringify(metadata)
      };
      dataInterface.uploadAssetFile(uid, data).done(result => {
        _this.setState({ layerName: '' });
        actions.resources.getAssetFiles(this.props.asset.uid);
      }).fail((jqxhr) => {
        var errMsg = t('Upload error: ##error_message##.').replace('##error_message##', jqxhr.statusText);
        alertify.error(errMsg);
      });
    });

    rejectedFiles.map(rej => {
      var errMsg = t('Upload error: not a valid map overlay format.');
      alertify.error(errMsg);
    });
  }
  layerNameChange(e) {
    this.setState({ layerName: e.target.value });
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
      onok: (evt, val) => {
        dataInterface.deleteAssetFile(this.props.asset.uid, uid).done(r => {
          actions.resources.getAssetFiles(this.props.asset.uid);
          dialog.destroy();
        });
      },
      oncancel: () => {
        dialog.destroy();
      }
    };
    dialog.set(opts).show();
  }
  tabLabel(tab) {
    switch (tab) {
      case 'overlays':
        return t('Overlays');
      case 'colors':
        return t('Marker Colors');
      case 'geoquestion':
        return t('Geopoint question');
    }
  }
  colorChange(val) {
    let settings = this.state.mapSettings;
    settings.colorSet = val;
    this.setState({ mapSettings: settings });
  }
  render() {
    let asset = this.props.asset,
      geoQuestions = this.state.geoQuestions,
      activeTab = this.state.activeModalTab;

    var tabs = ['colors'];

    if (this.userCan('change_asset', asset)) tabs.unshift('overlays');
    if (geoQuestions.length > 1) tabs.unshift('geoquestion');

    var modalTabs = tabs.map(function(tab, i) {
      return (
        <button
          className={`mdl-button mdl-button--tab ${
            this.state.activeModalTab === tab ? 'active' : ''
          }`}
          onClick={this.toggleTab}
          data-tabname={tab}
          key={i}
        >
          {this.tabLabel(tab)}
        </button>
      );
    }, this);
    return (
      <bem.GraphSettings>
        <ui.Modal.Tabs>{modalTabs}</ui.Modal.Tabs>
        <ui.Modal.Body>
          <div className='tabs-content map-settings'>
            {activeTab === 'geoquestion' && (
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
                        onChange={this.geoPointQuestionChange}
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
            {activeTab === 'overlays' && (
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
                          <span className='file-layer-name'>{file.name}</span>
                          <span
                            className='file-delete'
                            onClick={this.deleteFile}
                            data-tip={t('Delete layer')}
                            data-uid={file.uid}
                          >
                            <i className='k-icon-trash' />
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
                    onChange={this.layerNameChange}
                  />
                  <Dropzone
                    onDrop={this.dropFiles}
                    multiple={false}
                    className='dropzone'
                    accept={'.csv,.kml,.geojson,.wkt,.json,.kmz'}
                  >
                    <button className='mdl-button mdl-button--raised mdl-button--colored'>
                      {t('Upload')}
                    </button>
                  </Dropzone>
                </bem.FormModal__item>
              </div>
            )}
            {activeTab === 'colors' && (
              <bem.FormModal__item>
                <div className='map-settings__colors'>
                  {t('Choose the color set for the disaggregated map markers.')}
                  <MapColorPicker onChange={this.colorChange} mapSettings={this.state.mapSettings}/>
                </div>
              </bem.FormModal__item>
            )}
          </div>
        </ui.Modal.Body>

        {(activeTab === 'geoquestion' || activeTab === 'colors') &&
          <bem.Modal__footer>
            {this.userCan('change_asset', this.props.asset) &&
              <bem.Modal__footerButton
                onClick={this.resetMapSettings}
              >
                {t('Reset')}
              </bem.Modal__footerButton>
            }
            <bem.Modal__footerButton
              m='primary'
              onClick={this.saveMapSettings}
            >
              {t('Save')}
            </bem.Modal__footerButton>
          </bem.Modal__footer>
        }
      </bem.GraphSettings>
    );
  }
}

reactMixin(MapSettings.prototype, Reflux.ListenerMixin);
reactMixin(MapSettings.prototype, mixins.permissions);

export default MapSettings;
