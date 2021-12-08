import Reflux from 'reflux'
import {notify} from 'alertifyjs'
import {ROOT_URL} from 'js/constants';

const mfaActions = Reflux.createActions({
  activate: {children: ['completed', 'failed']},
  deactivate: {children: ['completed', 'failed']},
  isActive: {children: ['completed', 'failed']},
  confirm: {children: ['completed', 'failed']},
  reset: {children: ['completed', 'failed']},
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

export default mfaActions
