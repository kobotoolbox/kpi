import { Box } from '@mantine/core'
import React, { Suspense, useEffect, useState } from 'react'
import DocumentTitle from 'react-document-title'
import { actions } from '#/actions'
import assetStore, { type AssetStoreData } from '#/assetStore'
import bem from '#/bem'
import RESTServices from '#/components/RESTServices'
import LoadingSpinner from '#/components/common/loadingSpinner'
import FormMapWrapper from '#/components/map/formMapWrapper'
import SharingForm from '#/components/permissions/sharingForm.component'
import TransferProjects from '#/components/permissions/transferProjects/transferProjects.component'
import LimitNotifications from '#/components/usageLimits/limitNotifications.component'
import { PROJECT_SETTINGS_CONTEXTS } from '#/constants'
import type { AssetResponse } from '#/dataInterface'
import FormMedia from '#/project/FormMedia'
import { ProjectSettings } from '#/project/ProjectSettings'
import { type WithRouterProps, withRouter } from '#/router/legacy'
import { ROUTES } from '#/router/routerConstants'

const ConnectProjects = React.lazy(
  () => import(/* webpackPrefetch: true */ '#/components/dataAttachments/connectProjects'),
)
const DataTable = React.lazy(() => import(/* webpackPrefetch: true */ '#/components/submissions/DataTableWrapper'))
const ProjectDownloads = React.lazy(
  () => import(/* webpackPrefetch: true */ '#/components/projectDownloads/ProjectDownloads'),
)
const FormGallery = React.lazy(
  () => import(/* webpackPrefetch: true */ '#/components/formGallery/formGallery.component'),
)

const FormActivity = React.lazy(() => import(/* webpackPrefetch: true */ '#/components/activity/FormActivity'))

interface FormSubScreensProps extends WithRouterProps {
  /** Asset uid for the cases where it doesn't come from the route. */
  uid?: string
}

/**
 * Renders one of the project sub-screens - the Data ones (Table, Gallery, Map, Downloads) and the Settings ones (form
 * media, sharing, REST Services, activity, etc.). All of those routes point at this single component, which then picks
 * the screen by matching the current pathname against `ROUTES`.
 */
function FormSubScreens(props: FormSubScreensProps) {
  const [asset, setAsset] = useState<AssetResponse>()

  useEffect(() => {
    const uid = props.params.assetid || props.uid || props.params.uid
    if (!uid) {
      return
    }

    const cancelListener = assetStore.listen((data: AssetStoreData) => {
      const loadedAsset = data[uid]
      if (loadedAsset) {
        setAsset(loadedAsset)
      }
    })
    setAsset(assetStore.getAsset(uid))
    actions.resources.loadAsset({ id: uid })

    return cancelListener
  }, [props.params.assetid, props.params.uid, props.uid])

  const renderSettingsEditor = (loadedAsset: AssetResponse) => {
    const docTitle = loadedAsset.name || t('Untitled')
    return (
      <DocumentTitle title={`${docTitle} | KoboToolbox`}>
        <bem.FormView m='form-settings'>
          <LimitNotifications />
          <ProjectSettings context={PROJECT_SETTINGS_CONTEXTS.EXISTING} formAsset={loadedAsset} />
        </bem.FormView>
      </DocumentTitle>
    )
  }

  const renderSharing = (loadedAsset: AssetResponse) => {
    // The route uid rather than `asset.uid`, because right after navigating to a different project the state can
    // still hold the previous asset for a moment.
    const uid = props.params.assetid || props.params.uid

    return (
      <bem.FormView m='form-settings-sharing'>
        <LimitNotifications />

        {uid && <SharingForm assetUid={uid} />}

        <Box mt='xl'>
          <TransferProjects asset={loadedAsset} />
        </Box>
      </bem.FormView>
    )
  }

  const renderRecords = (loadedAsset: AssetResponse) => (
    <bem.FormView className='connect-projects'>
      <Suspense fallback={null}>
        <ConnectProjects asset={loadedAsset} />
      </Suspense>
    </bem.FormView>
  )

  const renderReset = () => <LoadingSpinner />

  const renderUpload = (loadedAsset: AssetResponse) => <FormMedia asset={loadedAsset} />

  // Nothing to render until the asset lands
  if (!asset) {
    return false
  }

  // Each of these is only in the path of one of the routes below. The `''` fallbacks are safe, as they make the
  // `case`s using them build a path that no other route's pathname can match.
  const viewby = props.params.viewby ?? ''
  const hookUid = props.params.hookUid ?? ''

  switch (props.router.location.pathname) {
      case ROUTES.FORM_TABLE.replace(':uid', asset.uid):
        return (
          <Suspense fallback={null}>
            <DataTable asset={asset} />
          </Suspense>
        )
      case ROUTES.FORM_GALLERY.replace(':uid', asset.uid):
        return (
          <Suspense fallback={<div>{t('Image Gallery')}</div>}>
            <FormGallery asset={asset} />
          </Suspense>
        )
      case ROUTES.FORM_MAP.replace(':uid', asset.uid):
        return <FormMapWrapper asset={asset} />
      case ROUTES.FORM_MAP_BY.replace(':uid', asset.uid).replace(':viewby', viewby):
        return <FormMapWrapper asset={asset} viewby={viewby} />
      case ROUTES.FORM_DOWNLOADS.replace(':uid', asset.uid):
        return (
          <Suspense fallback={null}>
            <ProjectDownloads asset={asset} />
          </Suspense>
        )
      case ROUTES.FORM_SETTINGS.replace(':uid', asset.uid):
        return renderSettingsEditor(asset)
      case ROUTES.FORM_MEDIA.replace(':uid', asset.uid):
        return renderUpload(asset)
      case ROUTES.FORM_SHARING.replace(':uid', asset.uid):
        return renderSharing(asset)
      case ROUTES.FORM_RECORDS.replace(':uid', asset.uid):
        return renderRecords(asset)
      case ROUTES.FORM_REST.replace(':uid', asset.uid):
        return <RESTServices asset={asset} />
      case ROUTES.FORM_REST_HOOK.replace(':uid', asset.uid).replace(':hookUid', hookUid):
        return <RESTServices asset={asset} hookUid={hookUid} />
      case ROUTES.FORM_RESET.replace(':uid', asset.uid):
        return renderReset()
      case ROUTES.FORM_ACTIVITY.replace(':uid', asset.uid):
        return <FormActivity />
    }

    const docTitle = asset.name || t('Untitled')

    // TODO: this fallback screen is a leftover - nothing ever fills the url in, so the iframe is always empty. To be
    // removed in DEV-2748.
    const iframeUrl = ''

    return (
      <DocumentTitle title={`${docTitle} | KoboToolbox`}>
        <bem.FormView>
          <bem.FormView__cell m='iframe'>
            <iframe src={iframeUrl} />
          </bem.FormView__cell>
        </bem.FormView>
      </DocumentTitle>
    )
}

export default withRouter(FormSubScreens)
