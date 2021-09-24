import React from 'react'
import {RouteComponentProps} from 'react-router'
import {ROUTES} from 'js/router/routerConstants'
import bem from 'js/bem'
import LoadingSpinner from 'js/components/common/loadingSpinner'
import './accountSidebar.scss'

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
    return location.hash.split('#')[1] === ROUTES.ACCOUNT_SETTINGS
  }

  isDataStorageSelected(): boolean {
    return location.hash.split('#')[1] === ROUTES.DATA_STORAGE
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
            href='#/account-settings'
          >
            {/*TODO: get a regular user icon*/}
            <i className='k-icon k-icon-user-share' />
            <bem.FormSidebar__labelText>
              {t('Profile')}
            </bem.FormSidebar__labelText>
          </bem.FormSidebar__label>

          <bem.FormSidebar__label
            m={{selected: this.isDataStorageSelected()}}
            href='#/data-storage'
          >
            {/*TODO: get the data usage icon*/}
            <i className='k-icon k-icon-projects' />
            <bem.FormSidebar__labelText>
              {t('Data storage')}
            </bem.FormSidebar__labelText>
          </bem.FormSidebar__label>
        </bem.FormSidebar>
      )
    }
  }
}
