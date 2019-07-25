import React from 'react';
import bem from 'js/bem';
import stores from 'js/stores';
// TODO: change to constant after #2259 is closed
import {t, anonUsername} from 'js/utils';

export function renderLoading(message = t('loading…')) {
  return (
    <bem.Loading>
      <bem.Loading__inner>
        <i />
        {message}
      </bem.Loading__inner>
    </bem.Loading>
  );
}

export function renderBackButton(isDisabled = false) {
  if (stores.pageState.hasPreviousModal()) {
    return (
      <bem.Modal__footerButton
        m='back'
        type='button'
        onClick={stores.pageState.switchToPreviousModal}
        disabled={isDisabled}
      >
        {t('Back')}
      </bem.Modal__footerButton>
    );
  } else {
    return null;
  }
}

/**
 * Validates a library asset data to see if ready to be made public
 *
 * @param {string} name
 * @param {string} organization
 * @param {string} sector
 *
 * @returns {boolean|Object} true for valid library asset and object with errors for invalid one.
 */
export function isLibraryAssetPublicReady(name, organization, sector) {
  const errors = {};
  if (!name) {
    errors.name = t('Name is required to make asset public');
  }
  if (!organization) {
    errors.organization = t('Organization is required to make asset public');
  }
  if (!sector) {
    errors.sector = t('Sector is required to make asset public');
  }

  if (Object.keys(errors).length >= 1) {
    return errors;
  } else {
    return true;
  }
}

/**
 * Checks whether the library asset is public.
 *
 * @param {Object[]} permissions - Asset permissions.
 * @param {boolean} isDiscoverable - If asset is discoverable when public.
 *
 * @returns {boolean} Is asset public.
 */
export function isLibraryAssetPublic(permissions, isDiscoverable) {
  // TODO: collections have `discoverable_when_public` property but it will go away
  // when they will become assets, for now disregard it when undefined
  if (isDiscoverable === false) {
    return false;
  }
  let isVisibleToAnonymous = false;
  permissions.forEach((perm) => {
    if (
      perm.user__username === anonUsername &&
      (
        // TODO: change to constant after #2259 is closed
        perm.permission === 'view_asset' ||
        perm.permission === 'view_collection'
      )
    ) {
      isVisibleToAnonymous = true;
    }
  });
   return isVisibleToAnonymous;
}
