import { Box, Group, TextInput } from '@mantine/core'
import { useQueryClient } from '@tanstack/react-query'
import React, { useState } from 'react'
import DocumentTitle from 'react-document-title'
import { useNavigate, useParams } from 'react-router-dom'
import {
  useAssetsPermissionAssignmentsCreate,
  useAssetsPermissionAssignmentsDestroy,
} from '#/api/react-query/manage-permissions'
import {
  getAssetsListQueryKey,
  getAssetsRetrieveQueryKey,
  useAssetsCreate,
  useAssetsDeploymentCreate,
  useAssetsDeploymentPartialUpdate,
  useAssetsRetrieve,
} from '#/api/react-query/manage-projects-and-library-content'
import { parsed } from '#/assetParserUtils'
import bem from '#/bem'
import ButtonNew from '#/components/common/ButtonNew'
import LoadingSpinner from '#/components/common/loadingSpinner'
import { openKoboConfirmModal } from '#/components/common/openKoboConfirmModal'
import KoboPrompt from '#/components/modals/koboPrompt'
import permConfig from '#/components/permissions/permConfig'
import { PERMISSIONS_CODENAMES } from '#/components/permissions/permConstants'
import { userCan, userCanRemoveSharedProject } from '#/components/permissions/utils'
import LimitNotifications from '#/components/usageLimits/limitNotifications.component'
import { ASSET_TYPES } from '#/constants'
import type { AssetResponse } from '#/dataInterface'
import { openFormLanguagesModal } from '#/project/FormLanguagesManager'
import { ROUTES } from '#/router/routerConstants'
import profileStore from '#/stores/profile'
import { ANON_USERNAME, buildUserUrl } from '#/users/utils'
import { notify } from '#/utils'
import FormLandingRedeploymentAlert from '../FormLandingRedeploymentAlert'
import FormHistory from './FormHistory'
import FormLandingActions from './FormLandingActions'
import FormLandingCollectData from './FormLandingCollectData'
import FormLandingInfo from './FormLandingInfo'
import FormLandingLanguages from './FormLandingLanguages'

/**
 * URL of the permission that lets anonymous users submit data to a project. This is a function rather than a module
 * constant, because `permConfig` throws when asked before the app has fetched its config.
 */
function getAnonCanAddSubmissionsPermUrl() {
  return permConfig.getPermissionByCodename(PERMISSIONS_CODENAMES.add_submissions)?.url
}

export default function FormLanding() {
  // Fallback for getting uid from URL, needed without WithRouter wrapper
  const { uid = '' } = useParams<{ uid: string }>()
  const [historyExpanded, setHistoryExpanded] = useState(false)
  // TODO: simplify this type
  const [prompt, setPrompt] = useState<
    { type: 'unarchive' } | { type: 'clone'; assetType: string; versionUid?: string } | null
  >(null)
  const [cloneName, setCloneName] = useState('')

  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const invalidateAssetQueries = () => {
    queryClient.invalidateQueries({ queryKey: getAssetsRetrieveQueryKey(uid) })
    queryClient.invalidateQueries({ queryKey: getAssetsListQueryKey() })
  }
  const assetQuery = useAssetsRetrieve(uid)
  const asset = assetQuery.data?.status === 200 ? parsed({ ...assetQuery.data.data }) : undefined
  const anonymousPermissionUrl = getAnonCanAddSubmissionsPermUrl()
  const anonymousSubmissionPermission = asset?.permissions.find(
    (permission) => permission.user === buildUserUrl(ANON_USERNAME) && permission.permission === anonymousPermissionUrl,
  )

  const createAssetMutation = useAssetsCreate({
    mutation: { onSettled: invalidateAssetQueries },
  })
  const createPermissionMutation = useAssetsPermissionAssignmentsCreate({
    mutation: { onSettled: invalidateAssetQueries },
  })
  const destroyPermissionMutation = useAssetsPermissionAssignmentsDestroy({
    mutation: { onSettled: invalidateAssetQueries },
  })
  const deployMutation = useAssetsDeploymentCreate({
    mutation: { onSettled: invalidateAssetQueries },
  })
  const deploymentUpdateMutation = useAssetsDeploymentPartialUpdate({
    mutation: { onSettled: invalidateAssetQueries },
  })

  const updateAssetAnonymousSubmissions = () => {
    if (!uid) return
    if (anonymousSubmissionPermission) {
      const assignmentUid = anonymousSubmissionPermission.url.split('/').filter(Boolean).at(-1)
      if (!assignmentUid) {
        notify.error(t('Failed to update permissions'))
        return
      }
      destroyPermissionMutation.mutate({ uidAsset: uid, uidPermissionAssignment: assignmentUid })
      return
    }
    if (!anonymousPermissionUrl) {
      notify.error(t('Failed to update permissions'))
      return
    }
    createPermissionMutation.mutate({
      uidAsset: uid,
      data: { user: buildUserUrl(ANON_USERNAME), permission: anonymousPermissionUrl },
    })
  }

  const callUnarchiveAsset = () => setPrompt({ type: 'unarchive' })

  const isCurrentVersionDeployed = (loadedAsset: AssetResponse) => {
    if (loadedAsset.deployment__active && loadedAsset.deployed_versions.count > 0 && loadedAsset.deployed_version_id) {
      const deployedVersion = loadedAsset.deployed_versions.results.find(
        (version) => version.uid === loadedAsset.deployed_version_id,
      )
      return deployedVersion?.content_hash === loadedAsset.version__content_hash
    }
    return false
  }
  const isFormRedeploymentNeeded = (loadedAsset: AssetResponse) =>
    !isCurrentVersionDeployed(loadedAsset) && userCan('change_asset', loadedAsset)
  const deployAsset = (loadedAsset: AssetResponse) => {
    if (loadedAsset.has_deployment) {
      openKoboConfirmModal({
        title: t('Overwrite existing deployment'),
        children: (
          <>
            {t('This form has already been deployed. Are you sure you want overwrite the existing deployment?')}
            <br />
            <br />
            <strong>{t('This action cannot be undone.')}</strong>
          </>
        ),
        labels: { confirm: t('Ok'), cancel: t('Cancel') },
        onConfirm: () => {
          deploymentUpdateMutation.mutate(
            { uidAsset: loadedAsset.uid, data: { active: true, version_id: loadedAsset.version_id ?? undefined } },
            { onSuccess: () => notify(t('redeployed form')) },
          )
        },
      })
      return
    }

    notify.warning(t('deploying to kobocat...'), { duration: 60 * 1000 })
    deployMutation.mutate(
      { uidAsset: loadedAsset.uid, data: { active: true } },
      {
        onSuccess: () => {
          notify(t('deployed form'))
          navigate(`/forms/${loadedAsset.uid}`)
        },
      },
    )
  }

  const cloneAsset = (assetType: string, versionUid?: string) => {
    if (!asset) return
    setCloneName(assetType === ASSET_TYPES.template.id ? asset.name || '' : `${t('Clone of')} ${asset.name || ''}`)
    setPrompt({ type: 'clone', assetType, versionUid })
  }

  const submitClone = () => {
    if (!asset || prompt?.type !== 'clone') return
    const data = {
      name: cloneName || asset.name || '',
      clone_from: asset.uid,
      asset_type: prompt.assetType,
      ...(prompt.versionUid ? { clone_from_version_id: prompt.versionUid } : {}),
    }
    createAssetMutation.mutate(
      { data },
      {
        onSuccess: (response) => {
          if (response.status !== 201) {
            notify.error(t('Failed to clone project'))
            return
          }
          setPrompt(null)
          if (prompt.assetType === ASSET_TYPES.survey.id) {
            navigate(ROUTES.FORM_LANDING.replace(':uid', response.data.uid))
          } else {
            navigate(ROUTES.LIBRARY)
          }
        },
      },
    )
  }

  const renderPrompt = () => {
    if (prompt?.type === 'unarchive') {
      return (
        <KoboPrompt
          isOpen
          title={t('Unarchive Project')}
          onRequestClose={() => setPrompt(null)}
          buttons={[
            { label: t('Cancel'), type: 'secondary', onClick: () => setPrompt(null) },
            {
              label: t('Unarchive'),
              isPending: deploymentUpdateMutation.isPending,
              onClick: () =>
                deploymentUpdateMutation.mutate(
                  { uidAsset: uid, data: { active: true } },
                  {
                    onSuccess: () => {
                      notify(t('Project unarchived successfully'))
                      setPrompt(null)
                    },
                  },
                ),
            },
          ]}
        >
          {t('Are you sure you want to unarchive this project?')}
        </KoboPrompt>
      )
    }
    if (prompt?.type === 'clone') {
      return (
        <KoboPrompt
          isOpen
          title={
            prompt.assetType === ASSET_TYPES.template.id
              ? t('Create new template from this project')
              : t('Clone Project')
          }
          onRequestClose={() => setPrompt(null)}
          buttons={[
            { label: t('Cancel'), type: 'secondary', onClick: () => setPrompt(null) },
            {
              label: prompt.assetType === ASSET_TYPES.template.id ? t('Create') : t('Clone'),
              isPending: createAssetMutation.isPending,
              onClick: submitClone,
            },
          ]}
        >
          <TextInput
            label={
              prompt.assetType === ASSET_TYPES.template.id
                ? t('Enter the name of the new template.')
                : t('Enter the name of the cloned project. Leave empty to keep the original name.')
            }
            value={cloneName}
            onChange={(event) => setCloneName(event.currentTarget.value)}
          />
        </KoboPrompt>
      )
    }
    return null
  }

  const showLanguagesModal = () => {
    if (asset) {
      openFormLanguagesModal(asset)
    }
  }

  // FormHistory owns the version list so we should keep the visibility and page-action wiring here
  const renderHistory = (loadedAsset: AssetResponse) => (
    <bem.FormView__row className={historyExpanded ? 'historyExpanded' : 'historyHidden'}>
      <bem.FormView__cell m={['columns', 'label', 'first', 'history-label']}>
        <bem.FormView__cell m='label'>{t('Form history')}</bem.FormView__cell>
      </bem.FormView__cell>

      <bem.FormView__cell m={['history-table']}>
        <FormHistory
          isEnabled={historyExpanded}
          assetUid={loadedAsset.uid}
          deployedVersionId={loadedAsset.deployed_version_id ?? undefined}
          deployedVersionsCount={loadedAsset.deployed_versions.count}
          deploymentActive={loadedAsset.deployment__active}
          deploymentStatus={loadedAsset.deployment_status}
          onClone={(versionUid) => cloneAsset(ASSET_TYPES.survey.id, versionUid)}
        />
      </bem.FormView__cell>
      {loadedAsset.deployed_versions.count > 1 && (
        <Group justify='center' gap='md' pt={historyExpanded ? 'md' : 0}>
          <ButtonNew
            size='md'
            onClick={() => setHistoryExpanded((expanded) => !expanded)}
            leftIcon={historyExpanded ? 'angle-up' : 'angle-down'}
            variant='transparent'
          >
            {historyExpanded ? t('Hide full history') : t('Show full history')}
          </ButtonNew>
        </Group>
      )}
    </bem.FormView__row>
  )

  const removeSharedProject = (loadedAsset: AssetResponse) => {
    const username = profileStore.currentAccount.username
    const assignmentUids = loadedAsset.permissions
      .filter((permission) => permission.user === buildUserUrl(username))
      .map((permission) => permission.url.split('/').filter(Boolean).at(-1))
      .filter((permissionUid): permissionUid is string => Boolean(permissionUid))
    if (assignmentUids.length === 0) {
      notify.error(t('Failed to remove permissions'))
      return
    }

    let remaining = assignmentUids.length
    let failed = false
    const onFinished = () => {
      remaining -= 1
      if (remaining !== 0) return
      if (!failed) navigate(ROUTES.FORMS)
    }
    assignmentUids.forEach((assignmentUid) => {
      destroyPermissionMutation.mutate(
        { uidAsset: loadedAsset.uid, uidPermissionAssignment: assignmentUid },
        {
          onSuccess: onFinished,
          onError: () => {
            failed = true
            onFinished()
          },
        },
      )
    })
  }

  if (!asset) {
    return <LoadingSpinner />
  }

  const docTitle = asset.name || t('Untitled')
  const userCanEdit = userCan('change_asset', asset)
  const isLoggedIn = profileStore.isLoggedIn

  return (
    <>
      <DocumentTitle title={`${docTitle} | ${t('Form')} | KoboToolbox`}>
        <bem.FormView m='form'>
          <LimitNotifications />
          <bem.FormView__row>
            <bem.FormView__cell m={['columns', 'first']}>
              <bem.FormView__cell m='label'>
                {asset.deployment__active
                  ? t('Current version')
                  : asset.has_deployment
                    ? t('Archived version')
                    : t('Draft version')}
              </bem.FormView__cell>
              <Box className='form-view__cell form-view__cell--action-buttons'>
                <FormLandingActions
                  asset={asset}
                  canEdit={userCanEdit}
                  isLoggedIn={isLoggedIn}
                  canRemoveSharedProject={userCanRemoveSharedProject(asset)}
                  onRemoveSharedProject={() => removeSharedProject(asset)}
                  onClone={(assetType) => cloneAsset(assetType)}
                />
              </Box>
            </bem.FormView__cell>
            <bem.FormView__cell m='box'>
              {isFormRedeploymentNeeded(asset) && <FormLandingRedeploymentAlert />}

              <FormLandingInfo
                asset={asset}
                canEdit={userCanEdit}
                isCurrentVersionDeployed={isCurrentVersionDeployed(asset)}
                onDeploy={() => deployAsset(asset)}
                onUnarchive={callUnarchiveAsset}
              />
              <FormLandingLanguages asset={asset} canEdit={userCanEdit} onManageLanguages={showLanguagesModal} />
            </bem.FormView__cell>
          </bem.FormView__row>
          {asset.deployed_versions.count > 0 && renderHistory(asset)}
          {asset.deployed_versions.count > 0 && asset.deployment__active && isLoggedIn && (
            <FormLandingCollectData
              asset={asset}
              anonymousSubmissionsEnabled={Boolean(anonymousSubmissionPermission)}
              canEdit={userCan('change_asset', asset)}
              onAnonymousSubmissionsChange={updateAssetAnonymousSubmissions}
            />
          )}
        </bem.FormView>
      </DocumentTitle>
      {renderPrompt()}
    </>
  )
}
