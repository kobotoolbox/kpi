import React from 'react'

import alertify from 'alertifyjs'
import type { Mixin } from 'create-react-class'
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

interface ContextRouterMixin extends Mixin<any, any> {
  isFormList: () => boolean
  isLibrary: () => boolean
  isMyLibrary: () => boolean
  isPublicCollections: () => boolean
  isLibrarySingle: () => boolean
  isFormSingle: () => boolean
  currentAssetID: () => string | undefined
  currentAsset: () => AssetResponse | undefined
  isActiveRoute: (path: string) => boolean
  isFormBuilder: () => boolean
}

interface DmixProps {
  params?: {
    assetid?: string
    uid?: string
  }
  formAsset?: AssetResponse
  uid?: string
  initialAssetLoadNotNeeded?: boolean
}

interface DmixState {
  historyExpanded?: boolean
  asset_type?: string
  summary?: any
  name?: string
  [key: string]: any
}

// Helper interface for the component context when this mixin is applied
interface DmixContext {
  props: DmixProps
  state: DmixState
  setState: (state: Partial<DmixState>) => void
}

// Note: This mixin assumes it will be mixed into a React.Component,
// so props/state/setState will be available at runtime
interface DmixMixin extends Mixin<DmixProps, DmixState> {
  afterCopy: (this: DmixMixin & DmixContext) => void
  saveCloneAs: (this: DmixMixin & DmixContext, versionId?: string) => void
  toggleDeploymentHistory: (this: DmixMixin & DmixContext) => void
  summaryDetails: (this: DmixMixin & DmixContext) => JSX.Element
  asJson: (this: DmixMixin & DmixContext) => JSX.Element
  dmixAssetStoreChange: (this: DmixMixin & DmixContext, data: { [uid: string]: AssetResponse }) => void
  _getAssetUid: (this: DmixMixin & DmixContext) => string | null | undefined
  componentWillUpdate: (this: DmixMixin & DmixContext, newProps: DmixProps) => void
  componentDidMount: (this: DmixMixin & DmixContext) => void
  componentWillUnmount: (this: DmixMixin & DmixContext) => void
  removeSharing: (this: DmixMixin & DmixContext) => void
  dmixAssetStoreCancelListener?: () => void
}

interface MixinsObject {
  contextRouter: ContextRouterMixin
  dmix: DmixMixin
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
    // props, state, and setState are added by react-mixin when mixed into a component
    afterCopy(this: DmixMixin & DmixContext) {
      notify(t('copied to clipboard'))
    },

    saveCloneAs(this: DmixMixin & DmixContext, versionId?: string) {
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
          const uid = this.props.params?.assetid || this.props.params?.uid
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
    toggleDeploymentHistory(this: DmixMixin & DmixContext) {
      this.setState({
        historyExpanded: !this.state.historyExpanded,
      })
    },
    summaryDetails(this: DmixMixin & DmixContext) {
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
    asJson(this: DmixMixin & DmixContext) {
      return (
        <pre>
          <code>{JSON.stringify(this.state, null, 4)}</code>
        </pre>
      )
    },
    dmixAssetStoreChange(this: DmixMixin & DmixContext, data: { [uid: string]: AssetResponse }) {
      const uid = this._getAssetUid()
      if (uid) {
        const asset = data[uid]
        if (asset) {
          this.setState(Object.assign({}, asset))
        }
      }
    },
    _getAssetUid(this: DmixMixin & DmixContext) {
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
    componentWillUpdate(this: DmixMixin & DmixContext, newProps: DmixProps) {
      if (this.props.params?.uid !== newProps.params?.uid) {
        // This case is used by other components (header.js is one such component)
        // in a not clear way to gain a data on new asset.
        if (newProps.params?.uid) {
          actions.resources.loadAsset({ id: newProps.params.uid })
        }
      }
    },

    componentDidMount(this: DmixMixin & DmixContext) {
      this.dmixAssetStoreCancelListener = assetStore.listen((data: AssetStoreData) => {
        this.dmixAssetStoreChange(data)
      }, this) as () => void

      // TODO 2/2
      // HACK FIX: for when we use `PermProtectedRoute`, we don't need to make the
      // call to get asset, as it is being already made. Ideally we want to have
      // this nice SSOT as described in TODO comment above.
      const uid = this._getAssetUid()
      if (uid && this.props.initialAssetLoadNotNeeded) {
        // When initialAssetLoadNotNeeded=true, the asset is already being loaded by PermProtectedRoute
        // Only set state if the asset data is actually available in the store
        // Otherwise, the listener will handle it when the data arrives
        if (assetStore.data[uid]) {
          this.setState(Object.assign({}, assetStore.data[uid]))
        }
      } else if (uid) {
        actions.resources.loadAsset({ id: uid }, true)
      }
    },

    componentWillUnmount(this: DmixMixin & DmixContext) {
      if (typeof this.dmixAssetStoreCancelListener === 'function') {
        this.dmixAssetStoreCancelListener()
      }
    },

    removeSharing(this: DmixMixin & DmixContext) {
      const uid = this.props.params?.uid
      if (uid) {
        removeAssetSharing(uid)
      }
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
      const assetId = this.currentAssetID()
      return assetId ? assetStore.data[assetId] : undefined
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
