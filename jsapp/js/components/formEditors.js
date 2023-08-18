import React from 'react';
import PropTypes from 'prop-types';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import editableFormMixin from '../editorMixins/editableForm';
import {update_states} from 'js/constants';
import {ROUTES} from 'js/router/routerConstants';
import mixins from '../mixins';
import {withRouter} from 'js/router/legacy';

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
FormPage.contextTypes = {router: PropTypes.object};

class LibraryAssetEditorComponent extends React.Component {
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


    if (this.props.router.path === ROUTES.EDIT_LIBRARY_ITEM) {
      this.state.isNewAsset = false;
    }

    if (this.props.router.path === ROUTES.NEW_LIBRARY_ITEM) {
      this.state.asset = false;
    }

    if (this.props.router.path === ROUTES.NEW_LIBRARY_CHILD) {
      this.state.asset = false;
      this.state.parentAsset = this.props.params.uid;
      this.state.backRoute = ROUTES.LIBRARY_ITEM.replace(
        ':uid',
        this.props.params.uid
      );
    }

    if (this.props.router.searchParams.get('back')) {
      this.state.backRoute = this.props.router.searchParams.get('back');
    }
  }
}
reactMixin(LibraryAssetEditorComponent.prototype, Reflux.ListenerMixin);
reactMixin(LibraryAssetEditorComponent.prototype, editableFormMixin);
LibraryAssetEditorComponent.contextTypes = {router: PropTypes.object};

export const LibraryAssetEditor = withRouter(LibraryAssetEditorComponent);
