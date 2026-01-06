import React from 'react'
import { update_states } from '#/constants'
import { type WithRouterProps, withRouter } from '#/router/legacy'
import { ROUTES } from '#/router/routerConstants'
import EditableForm from '../editorMixins/EditableForm'

/**
 * These are the components that are used for Form Builder routes.
 */

export class FormPage extends React.Component<WithRouterProps & { params: { uid?: string } }> {
  render() {
    return (
      <EditableForm
        asset_updated={update_states.UP_TO_DATE}
        multioptionsExpanded={true}
        surveyAppRendered={false}
        name={''}
        isNewAsset={false}
        assetUid={this.props.params.uid}
        backRoute={ROUTES.FORMS}
      />
    )
  }
}

class LibraryAssetEditorComponent extends React.Component<WithRouterProps & { params: { uid?: string } }> {
  render() {
    let isNewAsset = true
    if (this.props.router.path === ROUTES.EDIT_LIBRARY_ITEM) {
      isNewAsset = false
    }

    let forceCleanupAsset = false
    if (this.props.router.path === ROUTES.NEW_LIBRARY_ITEM) {
      forceCleanupAsset = true
    } else if (this.props.router.path === ROUTES.NEW_LIBRARY_CHILD) {
      forceCleanupAsset = true
    }

    let parentAssetUid: string | undefined
    if (this.props.router.path === ROUTES.NEW_LIBRARY_CHILD) {
      parentAssetUid = this.props.params.uid
    }

    let backRoute: string | null = ROUTES.LIBRARY
    if (this.props.router.path === ROUTES.NEW_LIBRARY_CHILD && this.props.params.uid) {
      backRoute = ROUTES.LIBRARY_ITEM.replace(':uid', this.props.params.uid)
    } else if (this.props.router.searchParams.get('back')) {
      backRoute = this.props.router.searchParams.get('back')
    }

    return (
      <EditableForm
        asset_updated={update_states.UP_TO_DATE}
        multioptionsExpanded={true}
        surveyAppRendered={false}
        name={''}
        isNewAsset={isNewAsset}
        assetUid={this.props.params.uid}
        backRoute={backRoute}
        parentAssetUid={parentAssetUid}
        forceCleanupAsset={forceCleanupAsset}
      />
    )
  }
}

export const LibraryAssetEditor = withRouter(LibraryAssetEditorComponent)
