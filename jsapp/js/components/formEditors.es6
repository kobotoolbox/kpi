import React from 'react';
import PropTypes from 'prop-types';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import editableFormMixin from '../editorMixins/editableForm';
import {
  update_states,
  ASSET_TYPES
} from 'js/constants';

export class LibraryAssetCreator extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      asset_updated: update_states.UP_TO_DATE,
      multioptionsExpanded: true,
      surveyAppRendered: false,
      name: '',
      asset: false,
      editorState: 'new',
      backRoute: '/library'
    };

    if (this.props.location.pathname === '/library/new/template') {
      this.state.desiredAssetType = ASSET_TYPES.template.id;
    }

    autoBind(this);
  }
}
reactMixin(LibraryAssetCreator.prototype, Reflux.ListenerMixin);
reactMixin(LibraryAssetCreator.prototype, editableFormMixin);
LibraryAssetCreator.contextTypes = {router: PropTypes.object};

export class LibraryChildAssetCreator extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      asset_updated: update_states.UP_TO_DATE,
      multioptionsExpanded: true,
      surveyAppRendered: false,
      name: '',
      asset: false,
      parentAsset: this.props.params.uid,
      editorState: 'new',
      backRoute: `/library/asset/${this.props.params.uid}`
    };

    autoBind(this);
  }
}
reactMixin(LibraryChildAssetCreator.prototype, Reflux.ListenerMixin);
reactMixin(LibraryChildAssetCreator.prototype, editableFormMixin);
LibraryChildAssetCreator.contextTypes = {router: PropTypes.object};

export class FormPage extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      asset_updated: update_states.UP_TO_DATE,
      multioptionsExpanded: true,
      surveyAppRendered: false,
      name: '',
      editorState: 'existing',
      backRoute: '/forms'
    };
    autoBind(this);
  }
}
reactMixin(FormPage.prototype, Reflux.ListenerMixin);
reactMixin(FormPage.prototype, editableFormMixin);
FormPage.contextTypes = {router: PropTypes.object};

export class LibraryAssetEditor extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      asset_updated: update_states.UP_TO_DATE,
      multioptionsExpanded: true,
      surveyAppRendered: false,
      name: '',
      editorState: 'existing',
      backRoute: '/library'
    };
    autoBind(this);
  }
}
reactMixin(LibraryAssetEditor.prototype, Reflux.ListenerMixin);
reactMixin(LibraryAssetEditor.prototype, editableFormMixin);
LibraryAssetEditor.contextTypes = {router: PropTypes.object};
