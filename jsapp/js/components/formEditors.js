import React from 'react'

import autoBind from 'react-autobind'
import reactMixin from 'react-mixin'
import Reflux from 'reflux'
import { update_states } from '#/constants'
import { withRouter } from '#/router/legacy'
import { ROUTES } from '#/router/routerConstants'
import editableFormMixin from '../editorMixins/editableForm'

/**
 * These are the components that are used for Form Builder routes.
 */

export class FormPage extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      asset_updated: update_states.UP_TO_DATE,
      multioptionsExpanded: true,
      surveyAppRendered: false,
      name: '',
      isNewAsset: false,
      backRoute: ROUTES.FORMS,
    }
    autoBind(this)
  }
}
reactMixin(FormPage.prototype, Reflux.ListenerMixin)
reactMixin(FormPage.prototype, editableFormMixin)

class LibraryAssetEditorComponent extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      asset_updated: update_states.UP_TO_DATE,
      multioptionsExpanded: true,
      surveyAppRendered: false,
      name: '',
      isNewAsset: true,
      backRoute: ROUTES.LIBRARY,
    }
    autoBind(this)

    if (this.props.router.path === ROUTES.EDIT_LIBRARY_ITEM) {
      this.state.isNewAsset = false
    }

    if (this.props.router.path === ROUTES.NEW_LIBRARY_ITEM) {
      this.state.asset = false
    }

    if (this.props.router.path === ROUTES.NEW_LIBRARY_CHILD) {
      this.state.asset = false
      this.state.parentAsset = this.props.params.uid
      this.state.backRoute = ROUTES.LIBRARY_ITEM.replace(':uid', this.props.params.uid)
    }

    if (this.props.router.searchParams.get('back')) {
      this.state.backRoute = this.props.router.searchParams.get('back')
    }
  }
}
reactMixin(LibraryAssetEditorComponent.prototype, Reflux.ListenerMixin)
reactMixin(LibraryAssetEditorComponent.prototype, editableFormMixin)

export const LibraryAssetEditor = withRouter(LibraryAssetEditorComponent)
