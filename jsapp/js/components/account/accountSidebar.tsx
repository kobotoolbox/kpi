import React from 'react'
import {ROUTES} from 'js/router/routerConstants'
import bem from 'js/bem'
import LoadingSpinner from 'js/components/common/loadingSpinner'
import Icon from 'js/components/common/icon'
import './accountSidebar.scss'

type AccountSidebarProps = {
  submissionsPerMonth: number
  /* TODO: Placeholder from mockups, naming and typing subject to change
    dataStoreage: any,
    transcriptionMinutes: any,
	  machineTranslation: any,
	*/
}

type AccountSidebarState = {
	isLoading: boolean
}

export default class AccountSidebar extends React.Component<
  AccountSidebarProps,
  AccountSidebarState
> {
  constructor(props: AccountSidebarProps) {
    super(props)
    this.state = {
      isLoading: true,
    }
  }

  componentDidMount() {
    this.setState({
      isLoading: false,
    })
  }

  isAccountSelected(): boolean {
    return (
      location.hash.split('#')[1] === ROUTES.ACCOUNT_SETTINGS
    )
  }

  isDataStorageSelected(): boolean {
    return location.hash.split('#')[1] === ROUTES.DATA_STORAGE
  }

  isSecuritySelected(): boolean {
    return location.hash.split('#')[1] === ROUTES.SECURITY
  }

  render() {
    let sidebarModifier = 'account'

    if (this.state.isLoading) {
      return <LoadingSpinner />
    } else {
      {/* temporary workaround to hide future sidebar routes */}
      return (
        <bem.FormSidebar m={sidebarModifier}>
          <bem.FormSidebar__label
            m={{selected: this.isAccountSelected()}}
            href={'#' + ROUTES.ACCOUNT_SETTINGS}
          >
            <Icon name='settings' size='xl'/>
            <bem.FormSidebar__labelText>
              {t('Account Settings')}
            </bem.FormSidebar__labelText>
          </bem.FormSidebar__label>
        </bem.FormSidebar>
      )
      {/* end temporary workaround */}
      return (
        <bem.FormSidebar m={sidebarModifier}>
          <bem.FormSidebar__label
            m={{selected: this.isAccountSelected()}}
            href={'#' + ROUTES.ACCOUNT_SETTINGS}
          >
            {/*TODO: get a regular user icon*/}
            <Icon name='user-share' size='xl'/>
            <bem.FormSidebar__labelText>
              {t('Profile')}
            </bem.FormSidebar__labelText>
          </bem.FormSidebar__label>

          <bem.FormSidebar__label
            m={{selected: this.isDataStorageSelected()}}
            href={'#' + ROUTES.DATA_STORAGE}
            disabled
          >
            {/*TODO: get the data usage icon*/}
            <Icon name='projects' size='xl'/>
            <bem.FormSidebar__labelText>
              {t('Data storage')}
            </bem.FormSidebar__labelText>
          </bem.FormSidebar__label>

          {window.MFAEnabled && <bem.FormSidebar__label
            m={{selected: this.isSecuritySelected()}}
            href={'#' + ROUTES.SECURITY}
            disabled
          >
            {/*TODO: get the data usage icon*/}
            <Icon name='lock' size='xl'/>
            <bem.FormSidebar__labelText>
              {t('Security')}
            </bem.FormSidebar__labelText>
          </bem.FormSidebar__label>
          }
        </bem.FormSidebar>
      )
    }
  }
}
