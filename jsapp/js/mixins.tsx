import React from 'react'

import alertify from 'alertifyjs'
import { removeAssetSharing } from '#/assetQuickActions'
import assetStore from '#/assetStore'
import type { AssetStoreData } from '#/assetStore'
import type { AssetResponse } from '#/dataInterface'
import { router } from '#/router/legacy'
import { ROUTES } from '#/router/routerConstants'
import {
  getCurrentPath,
  getRouteAssetUid,
  isAnyFormsRoute,
  isAnyLibraryRoute,
  isMyLibraryRoute,
  isNewLibraryItemRoute,
  isPublicCollectionsRoute,
} from '#/router/routerUtils'
import { notify, recordKeys } from '#/utils'
import { actions } from './actions'
import { ASSET_TYPES } from './constants'

interface MixinsObject {
  contextRouter: {
    [functionName: string]: Function
    context?: any
  }
  dmix: {
    [functionName: string]: Function
    state?: any
    props?: any
  }
}

/**
 * Mixins to be used via react-mixin plugin. These extend components with the
 * methods defined within the given mixin, using the component as `this`.
 *
 * NOTE: please try using mixins as less as possible - when needing a method
 * from here, move it out to separete file (utils?), import here to avoid
 * breaking the code and use the separete file instead of mixin.
 *
 * TODO: think about moving out of mixins, as they are deprecated in new React
 * versions and considered harmful (see
 * https://reactjs.org/blog/2016/07/13/mixins-considered-harmful.html).
 * See: https://github.com/kobotoolbox/kpi/issues/3907
 *
 * @deprecated Use some of the utils functions spread throught many files in
 * the repo (search for files with "utils" in the name). Some of the functions
 * below have direct replacements mentioned.
 */
const mixins: MixinsObject = {
  dmix: {
    afterCopy() {
      notify(t('copied to clipboard'))
    },

    saveCloneAs(versionId?: string) {
      const name = `${t('Clone of')} ${this.state.name}`

      const dialog = alertify.dialog('prompt')
      const opts = {
        title: `${t('Clone')} ${ASSET_TYPES.survey.label}`,
        message: t('Enter the name of the cloned ##ASSET_TYPE##. Leave empty to keep the original name.').replace(
          '##ASSET_TYPE##',
          ASSET_TYPES.survey.label,
        ),
        value: name,
        labels: { ok: t('Ok'), cancel: t('Cancel') },
        onok: ({}, value: string) => {
          const uid = this.props.params.assetid || this.props.params.uid
          actions.resources.cloneAsset(
            {
              uid: uid,
              name: value,
              version_id: versionId,
            },
            {
              onComplete: (asset: AssetResponse) => {
                dialog.destroy()
                router!.navigate(ROUTES.FORM.replace(':uid', asset.uid))
              },
            },
          )

          // keep the dialog open
          return false
        },
        oncancel: () => {
          dialog.destroy()
        },
      }
      dialog.set(opts).show()
    },
    // TODO: move this one shot function to formLanding or formHistory and remove from mixins
    toggleDeploymentHistory() {
      this.setState({
        historyExpanded: !this.state.historyExpanded,
      })
    },
    summaryDetails() {
      return (
        <pre>
          <code>
            {this.state.asset_type}
            <br />
            {`[${recordKeys(this.state).join(', ')}]`}
            <br />
            {JSON.stringify(this.state.summary, null, 4)}
          </code>
        </pre>
      )
    },
    asJson() {
      return (
        <pre>
          <code>{JSON.stringify(this.state, null, 4)}</code>
        </pre>
      )
    },
    dmixAssetStoreChange(data: { [uid: string]: AssetResponse }) {
      const uid = this._getAssetUid()
      const asset = data[uid]
      if (asset) {
        this.setState(Object.assign({}, asset))
      }
    },
    _getAssetUid() {
      if (this.props.params) {
        return this.props.params.assetid || this.props.params.uid
      } else if (this.props.formAsset) {
        // formAsset case is being used strictly for projectSettings component to
        // cause the componentDidMount callback to load the full asset (i.e. one
        // that includes `content`).
        return this.props.formAsset.uid
      } else {
        return this.props.uid || getRouteAssetUid()
      }
    },
    // TODO 1/2
    // Fix `componentWillUpdate` and `componentDidMount` asset loading flow.
    // Ideally we should build a single overaching component or store that would
    // handle loading of the asset in all necessary cases in a way that all
    // interested parties could use without duplication or confusion and with
    // indication when the loading starts and when ends.
    componentWillUpdate(newProps: any) {
      if (this.props.params?.uid !== newProps.params?.uid) {
        // This case is used by other components (header.js is one such component)
        // in a not clear way to gain a data on new asset.
        actions.resources.loadAsset({ id: newProps.params.uid })
      }
    },

    componentDidMount() {
      this.dmixAssetStoreCancelListener = assetStore.listen((data: AssetStoreData) => {
        this.dmixAssetStoreChange(data)
      }, this)

      // TODO 2/2
      // HACK FIX: for when we use `PermProtectedRoute`, we don't need to make the
      // call to get asset, as it is being already made. Ideally we want to have
      // this nice SSOT as described in TODO comment above.
      const uid = this._getAssetUid()
      if (uid && this.props.initialAssetLoadNotNeeded) {
        this.setState(Object.assign({}, assetStore.data[uid]))
      } else if (uid) {
        actions.resources.loadAsset({ id: uid }, true)
      }
    },

    componentWillUnmount() {
      if (typeof this.dmixAssetStoreCancelListener === 'function') {
        this.dmixAssetStoreCancelListener()
      }
    },

    removeSharing: function () {
      removeAssetSharing(this.props.params.uid)
    },
  },
  /**
   * @deprecated Use `routerUtils.ts` instead.
   */
  contextRouter: {
    isFormList() {
      return isAnyFormsRoute() && this.currentAssetID() === undefined
    },
    isLibrary() {
      return isAnyLibraryRoute()
    },
    isMyLibrary() {
      return isMyLibraryRoute()
    },
    isPublicCollections() {
      return isPublicCollectionsRoute()
    },
    isLibrarySingle() {
      return isAnyLibraryRoute() && this.currentAssetID() !== undefined
    },
    isFormSingle() {
      return isAnyFormsRoute() && this.currentAssetID() !== undefined
    },
    currentAssetID() {
      return getRouteAssetUid() ?? undefined
    },
    currentAsset() {
      return assetStore.data[this.currentAssetID()]
    },
    isActiveRoute(path: string) {
      return getCurrentPath().startsWith(path)
    },
    isFormBuilder() {
      if (isNewLibraryItemRoute()) {
        return true
      }

      const uid = this.currentAssetID()
      if (uid === undefined) {
        return false
      }

      return (
        getCurrentPath().startsWith(ROUTES.EDIT_LIBRARY_ITEM.replace(':uid', uid)) ||
        getCurrentPath().startsWith(ROUTES.NEW_LIBRARY_ITEM.replace(':uid', uid)) ||
        getCurrentPath().startsWith(ROUTES.FORM_EDIT.replace(':uid', uid))
      )
    },
  },
}

export default mixins
