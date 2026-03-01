import { when } from 'mobx'
import Reflux from 'reflux'
import { hasActiveSubscription } from '#/account/stripe.utils'
import { ROOT_URL } from '#/constants'
import envStore from '#/envStore'
import { notify } from '#/utils'

export type MfaErrorResponse = JQueryXHR & {
  non_field_errors?: string
}

export type MfaUserMethodsResponse = [
  {
    name: 'app'
    is_primary: boolean
    is_active: boolean
    date_created: string
    date_modified: string
    date_disabled: string
  },
]

export interface MfaActivatedResponse {
  details: string
  inModal?: boolean
}

export interface MfaBackupCodesResponse {
  backup_codes: string[]
}

/**
 * @deprecated migrate to react-query whenever you need to adjust things beyond simple rename
 */
const mfaActions = Reflux.createActions({
  getUserMethods: { children: ['completed', 'failed'] },
  activate: { children: ['completed', 'failed'] },
  deactivate: { children: ['completed', 'failed'] },
  isActive: { children: ['completed', 'failed'] },
  getMfaAvailability: { children: ['completed', 'failed'] },
  confirmCode: { children: ['completed', 'failed'] },
  regenerate: { children: ['completed', 'failed'] },
})

mfaActions.getUserMethods.listen(() => {
  $.ajax({
    dataType: 'json',
    method: 'GET',
    url: `${ROOT_URL}/api/v2/auth/mfa/user-methods/`,
  })
    .done((response: MfaUserMethodsResponse) => {
      mfaActions.getUserMethods.completed(response)
    })
    .fail((response: MfaErrorResponse) => {
      let errorText = t('An error occured')
      if (response.non_field_errors) {
        errorText = response.non_field_errors
      }
      notify(errorText, 'error')
      mfaActions.getUserMethods.failed(response)
    })
})

mfaActions.activate.listen((inModal?: boolean) => {
  $.ajax({
    dataType: 'json',
    method: 'POST',
    url: `${ROOT_URL}/api/v2/auth/app/activate/`,
  })
    .done((response: MfaActivatedResponse) => {
      // If we are reconfiguring MFA, we have to disable and enable in one step,
      // this avoids the case of closing and re-rendering the modal
      const inModalResponse = response
      if (inModal) {
        inModalResponse.inModal = inModal
      }
      mfaActions.activate.completed(inModalResponse)
    })
    .fail((response: MfaErrorResponse) => {
      let errorText = t('An error occured')
      if (response.non_field_errors) {
        errorText = response.non_field_errors
      }
      notify(errorText, 'error')
    })
})

mfaActions.getMfaAvailability.listen(() => {
  when(() => envStore.isReady).then(() => {
    const hasMfaList = envStore.data.mfa_has_availability_list
    const perUserAvailability = envStore.data.mfa_per_user_availability
    if (envStore.data.stripe_public_key) {
      hasActiveSubscription()
        .then((response) => {
          const isMfaAvailable = hasMfaList ? response || perUserAvailability : response
          mfaActions.getMfaAvailability.completed({ isMfaAvailable, isPlansMessageVisible: !isMfaAvailable })
        })
        .catch(() => {
          const errorText = t('An error occurred while checking subscription status')
          notify(errorText, 'error')
          mfaActions.getMfaAvailability.failed({ isMfaAvailable: false, isPlansMessageVisible: false })
        })
    } else {
      // If Stripe isn't enabled on the site, don't restrict MFA access
      mfaActions.getMfaAvailability.completed({
        isMfaAvailable: !hasMfaList || perUserAvailability,
        isPlansMessageVisible: false,
      })
    }
  })
})

mfaActions.confirmCode.listen((mfaCode: string) => {
  $.ajax({
    data: { code: mfaCode },
    dataType: 'json',
    method: 'POST',
    url: `${ROOT_URL}/api/v2/auth/app/activate/confirm/`,
  })
    .done(mfaActions.confirmCode.completed)
    .fail((response: MfaErrorResponse) => {
      let errorText = t('Incorrect token or something went wrong')
      if (response.non_field_errors) {
        errorText = response.non_field_errors
      }
      notify(errorText, 'error')
      mfaActions.confirmCode.failed(response)
    })
})

mfaActions.deactivate.listen((mfaCode: string) => {
  $.ajax({
    data: { code: mfaCode },
    dataType: 'json',
    method: 'POST',
    url: `${ROOT_URL}/api/v2/auth/app/deactivate/`,
  })
    .done(mfaActions.deactivate.completed)
    .fail((response: MfaErrorResponse) => {
      let errorText = t('Incorrect token or something went wrong')
      if (response.non_field_errors) {
        errorText = response.non_field_errors
      }
      notify(errorText, 'error')
      mfaActions.deactivate.failed(response)
    })
})

mfaActions.regenerate.listen((mfaCode: string) => {
  $.ajax({
    data: { code: mfaCode },
    dataType: 'json',
    method: 'POST',
    url: `${ROOT_URL}/api/v2/auth/app/codes/regenerate/`,
  })
    .done(mfaActions.regenerate.completed)
    .fail((response: MfaErrorResponse) => {
      let errorText = t('Incorrect token or something went wrong')
      if (response.non_field_errors) {
        errorText = response.non_field_errors
      }
      notify(errorText, 'error')
      mfaActions.regenerate.failed(response)
    })
})

export default mfaActions
