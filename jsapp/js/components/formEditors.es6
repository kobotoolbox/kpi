import React from 'react';
import PropTypes from 'prop-types';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import editableFormMixin from '../editorMixins/editableForm';
import mixins from '../mixins';
import {update_states} from 'js/constants';

export class FormPage extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      asset_updated: update_states.UP_TO_DATE,
      multioptionsExpanded: true,
      surveyAppRendered: false,
      name: '',
      isNewAsset: false,
      backRoute: '/forms'
    };
    autoBind(this);
  }
}
reactMixin(FormPage.prototype, Reflux.ListenerMixin);
reactMixin(FormPage.prototype, editableFormMixin);
reactMixin(FormPage.prototype, mixins.permissions);
FormPage.contextTypes = {router: PropTypes.object};

export class LibraryAssetEditor extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      asset_updated: update_states.UP_TO_DATE,
      multioptionsExpanded: true,
      surveyAppRendered: false,
      name: '',
      isNewAsset: true,
      backRoute: '/library'
    };
    autoBind(this);

    if (this.props.route.path === 'asset/:uid/edit') {
      this.state.isNewAsset = false;
    }

    if (this.props.route.path === 'asset/new') {
      this.state.asset = false;
    }

    if (this.props.route.path === 'asset/:uid/new') {
      this.state.asset = false;
      this.state.parentAsset = this.props.params.uid;
      this.state.backRoute = `/library/asset/${this.props.params.uid}`;
    }

    if (this.props.location.query.back) {
      this.state.backRoute = this.props.location.query.back;
    }
  }
}
reactMixin(LibraryAssetEditor.prototype, Reflux.ListenerMixin);
reactMixin(LibraryAssetEditor.prototype, editableFormMixin);
LibraryAssetEditor.contextTypes = {router: PropTypes.object};
