import { Box } from '@mantine/core'
import React, { Suspense } from 'react'
import DocumentTitle from 'react-document-title'
import { useLocation, useParams } from 'react-router-dom'
import { useAssetsRetrieve } from '#/api/react-query/manage-projects-and-library-content'
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

interface FormSubScreensProps {
  /** Asset uid for the cases where it doesn't come from the route. */
  uid?: string
}

/**
 * Renders one of the project sub-screens - the Data ones (Table, Gallery, Map, Downloads) and the Settings ones (form
 * media, sharing, REST Services, activity, etc.). All of those routes point at this single component, which then picks
 * the screen by matching the current pathname against `ROUTES`.
 */
function FormSubScreens(props: FormSubScreensProps) {
  const params = useParams()
  const location = useLocation()
  const assetUid = params.assetid || props.uid || params.uid || ''
  const assetQuery = useAssetsRetrieve(assetUid)
  // TODO: Legacy child components expect AssetResponse; we should unify these types in the future with the orval
  // generated types. Most likely need to go into the legacy types and ensure their logic matches return of the hook.
  const asset = assetQuery.data?.data as AssetResponse | undefined

  const renderSettingsEditor = (loadedAsset: AssetResponse) => {
    const docTitle = loadedAsset.name || t('Untitled')
    return (
      // TODO: `form-view` scss classes can be replaced with style props and the file can be removed once we update the
      // legacy components that use it to mantine style props. For now we can keep using the classes to avoid inconsistencies
      <DocumentTitle title={`${docTitle} | KoboToolbox`}>
        <Box className='form-view form-view--form-settings'>
          <LimitNotifications />
          <ProjectSettings context={PROJECT_SETTINGS_CONTEXTS.EXISTING} formAsset={loadedAsset} />
        </Box>
      </DocumentTitle>
    )
  }

  const renderSharing = (loadedAsset: AssetResponse) => {
    // The route uid rather than `asset.uid`, because right after navigating to a different project the state can
    // still hold the previous asset for a moment.
    const uid = params.assetid || params.uid

    return (
      // TODO: `form-view` scss classes can be replaced with style props
      <Box className='form-view form-view--form-settings-sharing'>
        <LimitNotifications />

        {uid && <SharingForm assetUid={uid} />}

        <Box mt='xl'>
          <TransferProjects asset={loadedAsset} />
        </Box>
      </Box>
    )
  }

  const renderRecords = (loadedAsset: AssetResponse) => (
    // TODO: `form-view` scss classes can be replaced with style props
    <Box className='form-view connect-projects'>
      <Suspense fallback={null}>
        <ConnectProjects asset={loadedAsset} />
      </Suspense>
    </Box>
  )

  const renderReset = () => <LoadingSpinner />

  const renderUpload = (loadedAsset: AssetResponse) => <FormMedia asset={loadedAsset} />

  // Nothing to render until the asset lands
  if (!asset) {
    return false
  }

  // Each of these is only in the path of one of the routes below. The `''` fallbacks are safe, as they make the
  // `case`s using them build a path that no other route's pathname can match.
  const viewby = params.viewby ?? ''
  const hookUid = params.hookUid ?? ''

  switch (location.pathname) {
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

    // For TS, should never happen
    return null
}

export default FormSubScreens
