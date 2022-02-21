import Reflux from 'reflux'
import {notify} from 'alertifyjs'
import {ROOT_URL} from 'js/constants'

type MfaErrorResponse = {
  non_field_errors: string
}

export type MfaActiveResponse = [{
  name: 'app',
  is_primary: boolean,
}]

export type MfaActivatedResponse = {
  details: string,
  inModal?: boolean,
}

export type MfaBackupCodesResponse = {
  backup_codes: string[]
}

const mfaActions = Reflux.createActions({
  activate: {children: ['completed', 'failed']},
  deactivate: {children: ['completed', 'failed']},
  isActive: {children: ['completed', 'failed']},
  confirmCode: {children: ['completed', 'failed']},
  regenerate: {children: ['completed', 'failed']},
})

mfaActions.isActive.listen(() => {
  $.ajax({
    dataType: 'json',
    method: 'GET',
    url: `${ROOT_URL}/api/v2/auth/mfa/user-active-methods/`,
  }).done((response: MfaActiveResponse) => {
    mfaActions.isActive.completed(response)
  }).fail((response: MfaErrorResponse | any) => {
    let errorText = t('An error occured')
    if (response.non_field_errors) {
      errorText = response.non_field_errors
    }
    notify(errorText, 'error')
  })
})

mfaActions.activate.listen((inModal?: boolean) => {
  $.ajax({
    dataType: 'json',
    method: 'POST',
    url: `${ROOT_URL}/api/v2/auth/app/activate/`,
  }).done((response: MfaActivatedResponse) => {
    // If we are reconfiguring MFA, we have to disable and enable in one step,
    // this avoids the case of closing and re-rendering the modal
    let inModalResponse = response
    if (inModal) {
      inModalResponse.inModal = inModal
    }
    mfaActions.activate.completed(inModalResponse)
  }).fail((response: MfaErrorResponse | any) => {
    let errorText = t('An error occured')
    if (response.non_field_errors) {
      errorText = response.non_field_errors
    }
    notify(errorText, 'error')
  })
})

mfaActions.confirmCode.listen((mfaCode: string) => {
  $.ajax({
    data: {code: mfaCode},
    dataType: 'json',
    method: 'POST',
    url: `${ROOT_URL}/api/v2/auth/app/activate/confirm/`,
  }).done(mfaActions.confirmCode.completed)
  .fail((response: MfaErrorResponse | any) => {
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
    data: {code: mfaCode},
    dataType: 'json',
    method: 'POST',
    url: `${ROOT_URL}/api/v2/auth/app/deactivate/`,
  }).done(mfaActions.deactivate.completed)
  .fail((response: MfaErrorResponse | any) => {
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
    data: {code: mfaCode},
    dataType: 'json',
    method: 'POST',
    url: `${ROOT_URL}/api/v2/auth/app/codes/regenerate/`,
  }).done(mfaActions.regenerate.completed)
  .fail((response: MfaErrorResponse | any) => {
    let errorText = t('Incorrect token or something went wrong')
    if (response.non_field_errors) {
      errorText = response.non_field_errors
    }
    notify(errorText, 'error')
    mfaActions.regenerate.failed(response)
  })
})

export default mfaActions
