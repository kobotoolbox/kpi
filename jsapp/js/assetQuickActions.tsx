/**
 * Hi! This file contains different methods for manipulating asset. Most of
 * these are meant to change the data on back-end.
 *
 * The reason for creating this file is to not burden `assetUtils.ts` with more
 * lines of code and to kill `mixins.tsx` as soon as possible (aiming at first
 * quarter of 2024 AKA The Far Future With Flying Cars :fingers_crossed:).
 */

import React from 'react';
import escape from 'lodash.escape';
import alertify from 'alertifyjs';
import {stores} from './stores';
import sessionStore from 'js/stores/session';
import {actions} from './actions';
import type {
  AssetResponse,
  PermissionResponse,
  ProjectViewAsset,
  DeploymentResponse,
} from './dataInterface';
import {router, routerIsActive} from './router/legacy';
import {ROUTES} from './router/routerConstants';
import {ASSET_TYPES, MODAL_TYPES} from './constants';
import {PERMISSIONS_CODENAMES} from 'js/components/permissions/permConstants';
import {notify, renderCheckbox} from './utils';
import assetUtils from './assetUtils';
import myLibraryStore from './components/library/myLibraryStore';
import permConfig from './components/permissions/permConfig';
import toast from 'react-hot-toast';
import {userCan} from './components/permissions/utils';
import {renderJSXMessage} from './alertify';
import pageState from 'js/pageState.store';

export function openInFormBuilder(uid: string) {
  if (routerIsActive(ROUTES.LIBRARY)) {
    router!.navigate(ROUTES.EDIT_LIBRARY_ITEM.replace(':uid', uid));
  } else {
    router!.navigate(ROUTES.FORM_EDIT.replace(':uid', uid));
  }
}

export function deleteAsset(
  assetOrUid: AssetResponse | ProjectViewAsset | string,
  name: string,
  callback?: (deletedAssetUid: string) => void
) {
  let asset: AssetResponse | ProjectViewAsset;
  if (typeof assetOrUid === 'object') {
    asset = assetOrUid;
  } else {
    asset = stores.allAssets.byUid[assetOrUid];
  }
  const assetTypeLabel = ASSET_TYPES[asset.asset_type].label;

  const safeName = escape(name);

  const dialog = alertify.dialog('confirm');
  const deployed = asset.has_deployment;
  let msg;
  let onshow;
  const onok = () => {
    actions.resources.deleteAsset(
      {uid: asset.uid, assetType: asset.asset_type},
      {
        onComplete: () => {
          notify(
            t('##ASSET_TYPE## deleted permanently').replace(
              '##ASSET_TYPE##',
              assetTypeLabel
            )
          );
          if (typeof callback === 'function') {
            callback(asset.uid);
          }
        },
      }
    );
  };

  if (!deployed) {
    if (asset.asset_type !== ASSET_TYPES.survey.id) {
      msg = t(
        'You are about to permanently delete this item from your library.'
      );
    } else {
      msg = t('You are about to permanently delete this draft.');
    }
  } else {
    msg = `${t('You are about to permanently delete this form.')}`;
    if (asset.deployment__submission_count !== 0) {
      msg += `${renderCheckbox(
        'dt1',
        t('All data gathered for this form will be deleted.')
      )}`;
    }
    msg += `${renderCheckbox(
      'dt2',
      t('The form associated with this project will be deleted.')
    )}`;
    msg += `${renderCheckbox(
      'dt3',
      t(
        'I understand that if I delete this project I will not be able to recover it.'
      ),
      true
    )}`;

    onshow = () => {
      const okBtn = dialog.elements.buttons.primary.firstChild as HTMLElement;
      okBtn.setAttribute('data-cy', 'delete');
      const $els = $('.alertify-toggle input');

      okBtn.setAttribute('disabled', 'true');
      $els.each(function () {
        $(this).prop('checked', false);
      });

      $els.change(function () {
        okBtn.removeAttribute('disabled');
        $els.each(function () {
          if (!$(this).prop('checked')) {
            okBtn.setAttribute('disabled', 'true');
          }
        });
      });
    };
  }
  const opts = {
    title: `${t('Delete')} ${assetTypeLabel} "${safeName}"`,
    message: msg,
    labels: {
      ok: t('Delete'),
      cancel: t('Cancel'),
    },
    onshow: onshow,
    onok: onok,
    oncancel: () => {
      dialog.destroy();
      $('.alertify-toggle input').prop('checked', false);
    },
  };
  dialog.set(opts).show();
}

/** Displays a confirmation popup before archiving. */
export function archiveAsset(
  assetOrUid: AssetResponse | ProjectViewAsset | string,
  callback?: (response: DeploymentResponse) => void
) {
  let asset: AssetResponse | ProjectViewAsset;
  if (typeof assetOrUid === 'object') {
    asset = assetOrUid;
  } else {
    asset = stores.allAssets.byUid[assetOrUid];
  }
  // TODO: stop using alertify here, use KoboPrompt
  const dialog = alertify.dialog('confirm');
  const opts = {
    title: t('Archive Project'),
    message: `${t('Are you sure you want to archive this project?')} <br/><br/>
      <strong>${t(
        'Your form will not accept submissions while it is archived.'
      )}</strong>`,
    labels: {ok: t('Archive'), cancel: t('Cancel')},
    onok: () => {
      actions.resources.setDeploymentActive(
        {
          asset: asset,
          active: false,
        },
        (response: DeploymentResponse) => {
          if (typeof callback === 'function') {
            callback(response);
          }
          dialog.destroy();
        }
      );
    },
    oncancel: () => {
      dialog.destroy();
    },
  };
  dialog.set(opts).show();
}

/** Displays a confirmation popup before unarchiving. */
export function unarchiveAsset(
  assetOrUid: AssetResponse | ProjectViewAsset | string,
  callback?: (response: DeploymentResponse) => void
) {
  let asset: AssetResponse | ProjectViewAsset;
  if (typeof assetOrUid === 'object') {
    asset = assetOrUid;
  } else {
    asset = stores.allAssets.byUid[assetOrUid];
  }
  // TODO: stop using alertify here, use KoboPrompt
  const dialog = alertify.dialog('confirm');
  const opts = {
    title: t('Unarchive Project'),
    message: `${t('Are you sure you want to unarchive this project?')}`,
    labels: {ok: t('Unarchive'), cancel: t('Cancel')},
    onok: () => {
      actions.resources.setDeploymentActive(
        {
          asset: asset,
          active: true,
        },
        (response: DeploymentResponse) => {
          if (typeof callback === 'function') {
            callback(response);
          }
          dialog.destroy();
        }
      );
    },
    oncancel: () => {
      dialog.destroy();
    },
  };
  dialog.set(opts).show();
}

/** Creates a duplicate of an asset. */
export function cloneAsset(
  assetOrUid: AssetResponse | ProjectViewAsset | string
) {
  let asset: AssetResponse | ProjectViewAsset;
  if (typeof assetOrUid === 'object') {
    asset = assetOrUid;
  } else {
    asset = stores.allAssets.byUid[assetOrUid];
  }
  const assetTypeLabel = ASSET_TYPES[asset.asset_type].label;

  let newName;
  const displayName = assetUtils.getAssetDisplayName(asset);
  // propose new name only if source asset name is not empty
  if (displayName.original) {
    newName = `${t('Clone of')} ${displayName.original}`;
  }

  const dialog = alertify.dialog('prompt');
  const okBtn = dialog.elements.buttons.primary.firstChild as HTMLElement;
  const opts = {
    title: `${t('Clone')} ${assetTypeLabel}`,
    message: t(
      'Enter the name of the cloned ##ASSET_TYPE##. Leave empty to keep the original name.'
    ).replace('##ASSET_TYPE##', assetTypeLabel),
    value: newName,
    labels: {ok: t('Ok'), cancel: t('Cancel')},
    onok: ({}, value: string) => {
      okBtn.setAttribute('disabled', 'true');
      okBtn.innerText = t('Cloning...');

      let parent;
      if ('parent' in asset && asset.parent) {
        const foundParentAsset = myLibraryStore.findAssetByUrl(asset.parent);
        const canAddToParent =
          typeof foundParentAsset !== 'undefined' &&
          userCan(PERMISSIONS_CODENAMES.change_asset, foundParentAsset);
        if (canAddToParent) {
          parent = asset.parent;
        }
      }

      actions.resources.cloneAsset(
        {
          uid: asset.uid,
          name: value,
          parent: parent,
        },
        {
          onComplete: (newAsset: AssetResponse) => {
            okBtn.removeAttribute('disabled');
            dialog.destroy();

            // TODO when on collection landing page and user clones this
            // collection's child asset, instead of navigating to cloned asset
            // landing page, it would be better to stay here and refresh data
            // (if the clone will keep the parent asset)
            let goToUrl;
            if (newAsset.asset_type === ASSET_TYPES.survey.id) {
              goToUrl = `/forms/${newAsset.uid}/landing`;
            } else {
              goToUrl = `/library/asset/${newAsset.uid}`;
            }

            router!.navigate(goToUrl);
            notify(
              t('cloned ##ASSET_TYPE## created').replace(
                '##ASSET_TYPE##',
                assetTypeLabel
              )
            );
          },
        }
      );
      // keep the dialog open
      return false;
    },
    oncancel: () => {
      dialog.destroy();
    },
  };
  dialog.set(opts).show();
}

/**
 * Creates a new asset with provided type. Please use shortcut methods defined
 * below.
 */
function _cloneAssetAsNewType(params: {
  sourceUid: string;
  sourceName: string;
  targetType: string;
  promptTitle: string;
  promptMessage: string;
}) {
  // TODO: stop using alertify here, use KoboPrompt
  const dialog = alertify.dialog('prompt');
  const opts = {
    title: params.promptTitle,
    message: params.promptMessage,
    value: escape(params.sourceName),
    labels: {ok: t('Create'), cancel: t('Cancel')},
    onok: ({}, value: string) => {
      // disable buttons
      // NOTE: we need to cast it as HTMLElement because of missing innerText in declaration.
      const button1 = dialog.elements.buttons.primary
        .children[0] as HTMLElement;
      button1.setAttribute('disabled', 'true');
      button1.innerText = t('Please wait…');
      dialog.elements.buttons.primary.children[1].setAttribute(
        'disabled',
        'true'
      );

      actions.resources.cloneAsset(
        {
          uid: params.sourceUid,
          name: value,
          new_asset_type: params.targetType,
        },
        {
          onComplete: (asset: AssetResponse) => {
            dialog.destroy();

            switch (asset.asset_type) {
              case ASSET_TYPES.survey.id:
                router!.navigate(
                  ROUTES.FORM_LANDING.replace(':uid', asset.uid)
                );
                break;
              case ASSET_TYPES.template.id:
              case ASSET_TYPES.block.id:
              case ASSET_TYPES.question.id:
                router!.navigate(ROUTES.LIBRARY);
                break;
            }
          },
          onFailed: () => {
            dialog.destroy();
            notify.error(t('Failed to create new asset!'));
          },
        }
      );

      // keep the dialog open
      return false;
    },
    oncancel: () => {
      dialog.destroy();
    },
  };
  dialog.set(opts).show();
}

/** To be used when creating a template from existing project. */
export function cloneAssetAsTemplate(sourceUid: string, sourceName: string) {
  _cloneAssetAsNewType({
    sourceUid: sourceUid,
    sourceName: sourceName,
    targetType: ASSET_TYPES.template.id,
    promptTitle: t('Create new template from this project'),
    promptMessage: t('Enter the name of the new template.'),
  });
}

/** To be used when creating a project from template. */
export function cloneAssetAsSurvey(sourceUid: string, sourceName: string) {
  _cloneAssetAsNewType({
    sourceUid: sourceUid,
    sourceName: sourceName,
    targetType: ASSET_TYPES.survey.id,
    promptTitle: t('Create new project from this template'),
    promptMessage: t('Enter the name of the new project.'),
  });
}

export function removeAssetSharing(uid: string) {
  /**
   * Extends `removeAllPermissions` from `userPermissionRow.component.tsx`:
   * Checks for permissions from current user before finding correct
   * "most basic" permission to remove.
   */
  const asset = stores.allAssets.byUid[uid];
  const userViewAssetPerm = asset.permissions.find(
    (perm: PermissionResponse) => {
      // Get permissions url related to current user
      const permUserUrl = perm.user.split('/');
      return (
        permUserUrl[permUserUrl.length - 2] ===
          sessionStore.currentAccount.username &&
        perm.permission ===
          permConfig.getPermissionByCodename(PERMISSIONS_CODENAMES.view_asset)
            ?.url
      );
    }
  );

  const dialog = alertify.dialog('confirm');
  const opts = {
    title: t('Remove shared form'),
    message: `${t('Are you sure you want to remove this shared form?')}`,
    labels: {ok: t('Remove'), cancel: t('Cancel')},
    onok: () => {
      // Only non-owners should have the asset removed from their asset list.
      // This menu option is only open to non-owners so we don't need to check again.
      const isNonOwner = true;
      actions.permissions.removeAssetPermission(
        uid,
        userViewAssetPerm.url,
        isNonOwner
      );
    },
    oncancel: () => {
      dialog.destroy();
    },
  };
  dialog.set(opts).show();
}

function _deployAssetFirstTime(
  asset: AssetResponse | ProjectViewAsset,
  callback?: (response: DeploymentResponse) => void
) {
  const deploymentToast = notify.warning(t('deploying to kobocat...'), {
    duration: 60 * 1000,
  });
  actions.resources.deployAsset(asset, false, {
    onDone: (response: DeploymentResponse) => {
      notify(t('deployed form'));
      actions.resources.loadAsset({id: asset.uid});
      router!.navigate(`/forms/${asset.uid}`);
      toast.dismiss(deploymentToast);
      if (typeof callback === 'function') {
        callback(response);
      }
    },
    onFail: () => {
      toast.dismiss(deploymentToast);
    },
  });
}

function _redeployAsset(
  asset: AssetResponse | ProjectViewAsset,
  callback?: (response: DeploymentResponse) => void
) {
  const dialog = alertify.dialog('confirm');
  const opts = {
    title: t('Overwrite existing deployment'),
    // We wrap the JSX code in curly braces inside of backticks to make a string
    // out of it (alertify requires a string).
    message: renderJSXMessage(
      <span>
        {t(
          'This form has already been deployed. Are you sure you want overwrite the existing deployment?'
        )}
        <br />
        <br />
        <strong>{t('This action cannot be undone.')}</strong>
      </span>
    ),
    labels: {ok: t('Ok'), cancel: t('Cancel')},
    onok: () => {
      const okBtn = dialog.elements.buttons.primary.firstChild as HTMLElement;
      okBtn.setAttribute('disabled', 'true');
      okBtn.innerText = t('Deploying...');
      actions.resources.deployAsset(asset, true, {
        onDone: (response: DeploymentResponse) => {
          notify(t('redeployed form'));
          // this ensures that after deploying an asset, we get the fresh data for it
          actions.resources.loadAsset({id: asset.uid}, true);
          if (dialog && typeof dialog.destroy === 'function') {
            dialog.destroy();
          }
          if (typeof callback === 'function') {
            callback(response);
          }
        },
        onFail: () => {
          if (dialog && typeof dialog.destroy === 'function') {
            dialog.destroy();
          }
        },
      });
      // keep the dialog open
      return false;
    },
    oncancel: () => {
      dialog.destroy();
    },
  };
  dialog.set(opts).show();
}

export function deployAsset(
  asset: AssetResponse | ProjectViewAsset,
  callback?: (response: DeploymentResponse) => void
) {
  if (!asset || asset.asset_type !== ASSET_TYPES.survey.id) {
    console.error('Asset not supplied or not of type "survey".');
    return;
  }
  if (!asset.has_deployment) {
    _deployAssetFirstTime(asset, callback);
  } else {
    _redeployAsset(asset, callback);
  }
}

/** Opens a modal for sharing asset. */
export function manageAssetSharing(uid: string) {
  pageState.showModal({type: MODAL_TYPES.SHARING, uid: uid});
}

/** Opens a modal for replacing an asset using a file. */
export function replaceAssetForm(asset: AssetResponse | ProjectViewAsset) {
  pageState.showModal({type: MODAL_TYPES.REPLACE_PROJECT, asset: asset});
}

/**
 * Opens a modal for modifying asset languages and translation strings. It can
 * receive `uid` and will fetch all data by itself, or be given all the data
 * up front via `asset` parameter.
 */
export function manageAssetLanguages(uid: string, asset?: AssetResponse) {
  pageState.showModal({
    type: MODAL_TYPES.FORM_LANGUAGES,
    assetUid: uid,
    asset: asset,
  });
}

export function manageAssetEncryption(uid: string) {
  pageState.showModal({type: MODAL_TYPES.ENCRYPT_FORM, assetUid: uid});
}

/** Opens a modal for modifying asset tags (also editable in Details Modal). */
export function modifyAssetTags(asset: AssetResponse | ProjectViewAsset) {
  pageState.showModal({type: MODAL_TYPES.ASSET_TAGS, asset: asset});
}

/**
 * Opens a modal for editing asset details. Currently handles only two types:
 * `template` and `collection`.
 */
export function manageAssetSettings(asset: AssetResponse) {
  let modalType;
  if (asset.asset_type === ASSET_TYPES.template.id) {
    modalType = MODAL_TYPES.LIBRARY_TEMPLATE;
  } else if (asset.asset_type === ASSET_TYPES.collection.id) {
    modalType = MODAL_TYPES.LIBRARY_COLLECTION;
  }
  if (modalType) {
    pageState.showModal({
      type: modalType,
      asset: asset,
    });
  } else {
    throw new Error(`Unsupported asset type: ${asset.asset_type}.`);
  }
}
