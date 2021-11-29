import React from 'react'
import {RouteComponentProps} from 'react-router'
import {ROUTES} from 'js/router/routerConstants'
import bem from 'js/bem'
import LoadingSpinner from 'js/components/common/loadingSpinner'
import Icon from 'js/components/common/icon'
import './accountSidebar.scss'

const ACCOUNT_SETTINGS_HREF = '#' + ROUTES.ACCOUNT_SETTINGS
const DATA_STORAGE_HREF = '#' + ROUTES.DATA_STORAGE
const SECURITY_HREF = '#' + ROUTES.SECURITY

type AccountSidebarProps = RouteComponentProps<
  {
    submissionsPerMonth: number
    /* TODO: Placeholder from mockups, naming and typing subject to change
      dataStoreage: any,
      transcriptionMinutes: any,
	    machineTranslation: any,
	 */
  },
  {}
>

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
    let sidebarModifier: string = 'account'

    if (this.state.isLoading) {
      return <LoadingSpinner />
    } else {
      return (
        <bem.FormSidebar m={sidebarModifier}>
          <bem.FormSidebar__label
            m={{selected: this.isAccountSelected()}}
            href={ACCOUNT_SETTINGS_HREF}
          >
            {/*TODO: get a regular user icon*/}
            <Icon name='user-share' size='xl'/>
            <bem.FormSidebar__labelText>
              {t('Profile')}
            </bem.FormSidebar__labelText>
          </bem.FormSidebar__label>

          <bem.FormSidebar__label
            m={{selected: this.isDataStorageSelected()}}
            href={DATA_STORAGE_HREF}
          >
            {/*TODO: get the data usage icon*/}
            <Icon name='projects' size='xl'/>
            <bem.FormSidebar__labelText>
              {t('Data storage')}
            </bem.FormSidebar__labelText>
          </bem.FormSidebar__label>

          <bem.FormSidebar__label
            m={{selected: this.isSecuritySelected()}}
            href={SECURITY_HREF}
          >
            {/*TODO: get the data usage icon*/}
            <Icon name='lock' size='xl'/>
            <bem.FormSidebar__labelText>
              {t('Security')}
            </bem.FormSidebar__labelText>
          </bem.FormSidebar__label>
        </bem.FormSidebar>
      )
    }
  }
}
