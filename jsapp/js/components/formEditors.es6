import React from 'react';
import PropTypes from 'prop-types';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import editableFormMixin from '../editorMixins/editableForm';
import {update_states} from 'js/constants';
import {ROUTES} from 'js/router/routerConstants';
import mixins from '../mixins';

/**
 * These are the components that are used for Form Builder routes.
 */

export class FormPage extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      asset_updated: update_states.UP_TO_DATE,
      multioptionsExpanded: true,
      surveyAppRendered: false,
      name: '',
      isNewAsset: false,
      backRoute: ROUTES.FORMS,
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
      backRoute: ROUTES.LIBRARY,
    };
    autoBind(this);

    if (this.props.route.path === ROUTES.EDIT_LIBRARY_ITEM) {
      this.state.isNewAsset = false;
    }

    if (this.props.route.path === ROUTES.NEW_LIBRARY_ITEM) {
      this.state.asset = false;
    }

    if (this.props.route.path === ROUTES.NEW_LIBRARY_CHILD) {
      this.state.asset = false;
      this.state.parentAsset = this.props.params.uid;
      this.state.backRoute = ROUTES.LIBRARY_ITEM.replace(':uid', this.props.params.uid);
    }

    if (this.props.location.query.back) {
      this.state.backRoute = this.props.location.query.back;
    }
  }
}
reactMixin(LibraryAssetEditor.prototype, Reflux.ListenerMixin);
reactMixin(LibraryAssetEditor.prototype, editableFormMixin);
LibraryAssetEditor.contextTypes = {router: PropTypes.object};
