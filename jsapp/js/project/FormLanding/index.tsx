import { Box, Group, Stack, TextInput } from '@mantine/core'
import { IconWorldFilled } from '@tabler/icons-react'
import { useQueryClient } from '@tanstack/react-query'
import React, { useState } from 'react'
import CopyToClipboard from 'react-copy-to-clipboard'
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
import AnonymousSubmission from '#/components/anonymousSubmission.component'
import ButtonNew from '#/components/common/ButtonNew'
import Button from '#/components/common/button'
import LoadingSpinner from '#/components/common/loadingSpinner'
import { openKoboConfirmModal } from '#/components/common/openKoboConfirmModal'
import KoboPrompt from '#/components/modals/koboPrompt'
import permConfig from '#/components/permissions/permConfig'
import { PERMISSIONS_CODENAMES } from '#/components/permissions/permConstants'
import { userCan, userCanRemoveSharedProject } from '#/components/permissions/utils'
import LimitNotifications from '#/components/usageLimits/limitNotifications.component'
import { ASSET_TYPES, COLLECTION_METHODS, CollectionMethodName } from '#/constants'
import type { AssetResponse } from '#/dataInterface'
import envStore from '#/envStore'
import { openFormLanguagesModal } from '#/project/FormLanguagesManager'
import CollectMethodSelector from '#/project/collectMethodSelector.component'
import { ROUTES } from '#/router/routerConstants'
import profileStore from '#/stores/profile'
import { ANON_USERNAME, buildUserUrl } from '#/users/utils'
import { formatTime, notify } from '#/utils'
import FormLandingRedeploymentAlert from '../FormLandingRedeploymentAlert'
import FormHistory from './FormHistory'
import FormLandingActions from './FormLandingActions'

/**
 * URL of the permission that lets anonymous users submit data to a project. This is a function rather than a module
 * constant, because `permConfig` throws when asked before the app has fetched its config.
 */
function getAnonCanAddSubmissionsPermUrl() {
  return permConfig.getPermissionByCodename(PERMISSIONS_CODENAMES.add_submissions)?.url
}

/**
 * The URL for collecting data with given method. `null` for the Android app, which has no link, and for methods the
 * deployment didn't give us a link for.
 */
function getCollectMethodLink(loadedAsset: AssetResponse, method: CollectionMethodName): string | null {
  if (method === CollectionMethodName.android) {
    return null
  }
  return loadedAsset.deployment__links[method] || null
}

export default function FormLanding() {
  // Fallback for getting uid from URL, needed without WithRouter wrapper
  const { uid = '' } = useParams<{ uid: string }>()
  const [selectedCollectMethod, setSelectedCollectMethod] = useState(CollectionMethodName.offline_url)
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
  const hasLanguagesDefined = (translations: Array<string | null> | undefined) =>
    Boolean(translations && (translations.length > 1 || translations[0] !== null))

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

  // TODO: FormInfo should be a seperate component
  const renderFormInfo = (loadedAsset: AssetResponse, userCanEdit: boolean) => {
    let dvcount = loadedAsset.deployed_versions.count
    let undeployedVersion: string | undefined
    // Undeployed changes count as a version of their own, so the number we show is one ahead of the deployed count.
    if (!isCurrentVersionDeployed(loadedAsset)) {
      undeployedVersion = `(${t('undeployed')})`
      dvcount = dvcount + 1
    }
    return (
      <bem.FormView__cell m={['columns', 'padding']}>
        <bem.FormView__cell>
          <bem.FormView__cell m='version'>{dvcount > 0 ? `v${dvcount}` : ''}</bem.FormView__cell>
          {undeployedVersion && userCanEdit && (
            <bem.FormView__cell m='undeployed'>&nbsp;{undeployedVersion}</bem.FormView__cell>
          )}
          <bem.FormView__cell m='date'>
            {t('Last Modified')}&nbsp;:&nbsp;
            {loadedAsset.date_modified && formatTime(loadedAsset.date_modified)}&nbsp;-&nbsp;
            <span className='question-count'>
              {loadedAsset.summary.row_count || '0'}&nbsp;
              {t('questions')}
            </span>
          </bem.FormView__cell>
        </bem.FormView__cell>
        <bem.FormView__cell m='buttons'>
          {userCanEdit && loadedAsset.deployment_status === 'deployed' && (
            <Button
              type='primary'
              size='l'
              isUpperCase
              onClick={() => deployAsset(loadedAsset)}
              label={t('redeploy')}
            />
          )}
          {userCanEdit && loadedAsset.deployment_status === 'draft' && (
            <Button type='primary' size='l' isUpperCase onClick={() => deployAsset(loadedAsset)} label={t('deploy')} />
          )}
          {userCanEdit && loadedAsset.deployment_status === 'archived' && (
            <Button type='primary' size='l' isUpperCase onClick={callUnarchiveAsset} label={t('unarchive')} />
          )}
        </bem.FormView__cell>
      </bem.FormView__cell>
    )
  }

  const showLanguagesModal = (evt: React.MouseEvent<HTMLElement>) => {
    evt.preventDefault()
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

  // TODO: CollectData should be a seperate component
  const renderCollectData = (loadedAsset: AssetResponse) => {
    const chosenMethod = selectedCollectMethod
    const chosenMethodLink = getCollectMethodLink(loadedAsset, chosenMethod)

    // KoboCollect wants just the origin, and `open_rosa_server` is a full URL - let the DOM parse it out for us.
    const openRosaServerAnchor = document.createElement('a')
    openRosaServerAnchor.href = envStore.data.open_rosa_server
    const kobocollectUrl = openRosaServerAnchor.origin

    return (
      <bem.FormView__row>
        <bem.FormView__cell m={['label', 'first']}>{t('Collect data')}</bem.FormView__cell>
        <bem.FormView__cell m='box'>
          <bem.FormView__cell m={['columns', 'padding', 'collect-header']}>
            <bem.FormView__cell>
              <CollectMethodSelector
                onChange={(newMethod) => {
                  setSelectedCollectMethod(newMethod)
                }}
                selectedMethod={chosenMethod}
              />
            </bem.FormView__cell>

            <bem.FormView__cell className='collect-header-actions'>{renderCollectLink(loadedAsset)}</bem.FormView__cell>
          </bem.FormView__cell>

          <Stack pb='lg' pl='lg' pr='lg' className='collect-meta-description'>
            {chosenMethod !== CollectionMethodName.android && COLLECTION_METHODS[chosenMethod].desc}

            {chosenMethod === CollectionMethodName.iframe_url && (
              <pre>{`<iframe src="${chosenMethodLink}" width="800" height="600"></iframe>`}</pre>
            )}

            {chosenMethod === CollectionMethodName.android && (
              <ol>
                <li>
                  {t('Install')}
                  &nbsp;
                  <a
                    href='https://play.google.com/store/apps/details?id=org.koboc.collect.android&hl=en'
                    target='_blank'
                  >
                    KoboCollect
                  </a>
                  &nbsp;
                  {t('on your Android device.')}
                </li>
                <li>{t('Select the option "Manually enter project details"')}</li>
                <li>
                  {t('Enter the server URL')}&nbsp;
                  <code>{kobocollectUrl}</code>&nbsp;
                  {t('and your username and password')}
                </li>
                <li>{t('Select "Download form" and select this project')}</li>
                <li>{t('Select "Start New Form"')}</li>
                <li>{t('Select this project from the list of downloaded projects')}</li>
              </ol>
            )}
          </Stack>

          {userCan('change_asset', loadedAsset) && (
            <bem.FormView__cell m={['padding', 'anonymous-submissions', 'bordertop']}>
              <AnonymousSubmission
                checked={Boolean(anonymousSubmissionPermission)}
                // This whole block is already behind a `change_asset` check, so the toggle is always usable here.
                disabled={false}
                onChange={updateAssetAnonymousSubmissions}
              />
            </bem.FormView__cell>
          )}
        </bem.FormView__cell>
      </bem.FormView__row>
    )
  }

  const renderCollectLink = (loadedAsset: AssetResponse) => {
    const chosenMethod = selectedCollectMethod
    const chosenMethodLink = getCollectMethodLink(loadedAsset, chosenMethod)

    if (chosenMethod === CollectionMethodName.android) {
      return (
        <Button
          type='secondary'
          size='m'
          onClick={() => {
            window.open(COLLECTION_METHODS.android.url, '_blank')
          }}
          label={t('Download KoboCollect')}
        />
      )
    }

    if (chosenMethodLink === null) {
      return (
        <span
          className='collect-link-missing right-tooltip'
          data-tip={t("Try reloading the page, if problem doesn't go away, contact support.")}
        >
          <i className='k-icon k-icon-alert' />
          {t('Link missing')}
        </span>
      )
    }

    if (chosenMethod === CollectionMethodName.iframe_url) {
      return (
        <CopyToClipboard
          text={`<iframe src=${chosenMethodLink} width="800" height="600"></iframe>`}
          onCopy={() => {
            notify(t('Copied to clipboard'))
          }}
          options={{ format: 'text/plain' }}
        >
          <Button type='secondary' size='m' label={t('Copy')} />
        </CopyToClipboard>
      )
    }

    return (
      <React.Fragment>
        <CopyToClipboard
          text={chosenMethodLink}
          onCopy={() => {
            notify(t('Copied to clipboard'))
          }}
          options={{ format: 'text/plain' }}
        >
          <Button type='secondary' size='m' label={t('Copy')} />
        </CopyToClipboard>

        <Button
          type='secondary'
          size='m'
          onClick={() => {
            window.open(chosenMethodLink, '_blank')
          }}
          label={t('Open')}
        />
      </React.Fragment>
    )
  }

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

  // TODO: FormLanguages should be a seperate component and keep the layout that joins it to FormInfo in FormLanding.
  const renderLanguages = (loadedAsset: AssetResponse, canEdit: boolean) => {
    const translations = loadedAsset.content?.translations

    return (
      <bem.FormView__cell m={['columns', 'padding', 'bordertop']}>
        <bem.FormView__cell m='translation-list'>
          <strong>{t('Languages:')}</strong>
          &nbsp;
          {!hasLanguagesDefined(translations) && t('This project has no languages defined yet')}
          {hasLanguagesDefined(translations) && (
            <ul>
              {translations?.map((langString, n) => (
                <li key={n}>{langString || t('Unnamed language')}</li>
              ))}
            </ul>
          )}
        </bem.FormView__cell>

        {canEdit && (
          <bem.FormView__cell>
            <ButtonNew variant='outline' size='md' rightIcon={IconWorldFilled} onClick={showLanguagesModal}>
              {t('Manage')}
            </ButtonNew>
          </bem.FormView__cell>
        )}
      </bem.FormView__cell>
    )
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

              {renderFormInfo(asset, userCanEdit)}
              {renderLanguages(asset, userCanEdit)}
            </bem.FormView__cell>
          </bem.FormView__row>
          {asset.deployed_versions.count > 0 && renderHistory(asset)}
          {asset.deployed_versions.count > 0 && asset.deployment__active && isLoggedIn && renderCollectData(asset)}
        </bem.FormView>
      </DocumentTitle>
      {renderPrompt()}
    </>
  )
}
