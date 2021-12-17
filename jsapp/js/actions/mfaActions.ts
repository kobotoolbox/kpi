import Reflux from 'reflux'
import {notify} from 'alertifyjs'
import {ROOT_URL} from 'js/constants';

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
  }).done((response) => {
    mfaActions.isActive.completed(response)
  }).fail((response) => {
    notify(response.responseJSON, 'error')
  })
})

mfaActions.activate.listen(() => {
  $.ajax({
    dataType: 'json',
    method: 'POST',
    url: `${ROOT_URL}/api/v2/auth/app/activate/`,
  }).done((response) => {
    mfaActions.activate.completed(response)
  }).fail((response) => {
    notify(response.responseJSON, 'error')
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
  }).fail((response) => {
    notify(response.responseJSON, 'error')
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
  }).fail((response) => {
    notify(response.responseJSON, 'error')
  })
})

mfaActions.regenerate.listen((mfaCode: string) => {
  $.ajax({
    data: {code: mfaCode},
    dataType: 'json',
    method: 'POST',
    url: `${ROOT_URL}/api/v2/auth/app/codes/regenerate/`,
  }).done((response) => {
    mfaActions.deactivate.completed(response)
  }).fail((response) => {
    notify(response.responseJSON, 'error')
  })
})

export default mfaActions
