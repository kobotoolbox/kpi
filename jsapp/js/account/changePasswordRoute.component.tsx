import React from 'react'
import DocumentTitle from 'react-document-title'
import { observer } from 'mobx-react'
import sessionStore from '#/stores/session'
import bem, { makeBem } from '#/bem'
import { withRouter } from '#/router/legacy'
import type { WithRouterProps } from '#/router/legacy'
import './accountSettings.scss'
import styles from './changePasswordRoute.module.scss'
import UpdatePasswordForm from './security/password/updatePasswordForm.component'
import Button from '#/components/common/button'
import Avatar from '#/components/common/avatar'

bem.AccountSettings = makeBem(null, 'account-settings')
bem.AccountSettings__left = makeBem(bem.AccountSettings, 'left')
bem.AccountSettings__right = makeBem(bem.AccountSettings, 'right')
bem.AccountSettings__item = makeBem(bem.FormModal, 'item')
bem.AccountSettings__actions = makeBem(bem.AccountSettings, 'actions')

const ChangePasswordRoute = class ChangePassword extends React.Component<WithRouterProps> {
  close() {
    this.props.router.navigate(-1)
  }

  render() {
    if (!sessionStore.isLoggedIn) {
      return null
    }

    const accountName = sessionStore.currentAccount.username

    return (
      <DocumentTitle title={`${accountName} | KoboToolbox`}>
        <bem.AccountSettings>
          <bem.AccountSettings__actions>
            <Button type='text' size='l' startIcon='close' onClick={this.close.bind(this)} />
          </bem.AccountSettings__actions>

          <bem.AccountSettings__item m='column'>
            <bem.AccountSettings__item m='username'>
              <Avatar size='m' username={accountName} isUsernameVisible />
            </bem.AccountSettings__item>

            <div className={styles.fieldsWrapper}>
              <UpdatePasswordForm />
            </div>
          </bem.AccountSettings__item>
        </bem.AccountSettings>
      </DocumentTitle>
    )
  }
}

export default observer(withRouter(ChangePasswordRoute))
