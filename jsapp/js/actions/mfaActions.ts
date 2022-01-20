import Reflux from 'reflux'
import {notify} from 'alertifyjs'
import {ROOT_URL} from 'js/constants';

export type mfaErrorResponse = {
  non_field_errors: string
}

export type mfaActiveResponse = [{
  name: 'app',
  is_primary: boolean,
}]

export type mfaActivatedResponse = {
  details: string,
  inModal?: boolean,
}

export type mfaBackupCodesResponse = {
  backup_codes: Array<string>
}

const mfaActions = Reflux.createActions({
  activate: {children: ['completed', 'failed']},
  deactivate: {children: ['completed', 'failed']},
  isActive: {children: ['completed', 'failed']},
  confirm: {children: ['completed', 'failed']},
  regenerate: {children: ['completed', 'failed']},
})

mfaActions.isActive.listen(() => {
  $.ajax({
    dataType: 'json',
    method: 'GET',
    url: `${ROOT_URL}/api/v2/auth/mfa/user-active-methods/`,
  }).done((response: mfaActiveResponse) => {
    mfaActions.isActive.completed(response)
  }).fail((response: mfaErrorResponse | any) => {
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
  }).done((response: mfaActivatedResponse) => {
    // If we are reconfiguring MFA, we have to disable and enable in one step,
    // this avoids the case of closing and re-rendering the modal
    let inModalResponse = response
    if (inModal) {
      inModalResponse.inModal = inModal
    }
    mfaActions.activate.completed(inModalResponse)
  }).fail((response: mfaErrorResponse | any) => {
    let errorText = t('An error occured')
    if (response.non_field_errors) {
      errorText = response.non_field_errors
    }
    notify(errorText, 'error')
  })
})

mfaActions.confirm.listen((mfaCode: string) => {
  $.ajax({
    data: {code: mfaCode},
    dataType: 'json',
    method: 'POST',
    url: `${ROOT_URL}/api/v2/auth/app/activate/confirm/`,
  }).done((response) => {
    mfaActions.confirm.completed(response)
  }).fail((response: mfaErrorResponse | any) => {
    let errorText = t('An error occured')
    if (response.non_field_errors) {
      errorText = response.non_field_errors
    }
    notify(errorText, 'error')
  })
})

mfaActions.deactivate.listen((mfaCode: string) => {
  $.ajax({
    data: {code: mfaCode},
    dataType: 'json',
    method: 'POST',
    url: `${ROOT_URL}/api/v2/auth/app/deactivate/`,
  }).done((response) => {
    mfaActions.deactivate.completed(response)
  }).fail((response: mfaErrorResponse | any) => {
    let errorText = t('An error occured')
    if (response.non_field_errors) {
      errorText = response.non_field_errors
    }
    notify(errorText, 'error')
  })
})

mfaActions.regenerate.listen((mfaCode: string) => {
  $.ajax({
    data: {code: mfaCode},
    dataType: 'json',
    method: 'POST',
    url: `${ROOT_URL}/api/v2/auth/app/codes/regenerate/`,
  }).done((response) => {
    mfaActions.regenerate.completed(response)
  }).fail((response: mfaErrorResponse | any) => {
    let errorText = t('An error occured')
    if (response.non_field_errors) {
      errorText = response.non_field_errors
    }
    notify(errorText, 'error')
  })
})

export default mfaActions
