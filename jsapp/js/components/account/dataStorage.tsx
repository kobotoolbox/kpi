import React from 'react'
import bem, {makeBem} from 'js/bem'
import KoboDropdown, {
  KoboDropdownThemes,
  KoboDropdownPlacements,
} from 'js/components/common/koboDropdown'
import './dataStorage.scss'
//import {ROUTES} from 'js/router/routerConstants'
//import bem from 'js/bem'
//import LoadingSpinner from 'js/components/common/loadingSpinner'

bem.DataStorage = makeBem(null, 'data-storage')
bem.DataStorage__header = makeBem(bem.DataStorage, 'header')
bem.DataStorage__data = makeBem(bem.DataStorage, 'data')

bem.DataRow = makeBem(null, 'data-row')
bem.DataRow__header = makeBem(bem.DataRow, 'header')
bem.DataRow__data = makeBem(bem.DataRow, 'data')

export default class DataStorage extends React.Component<
  {}, {}
> {
  constructor(props: any) {
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

  render() {
    return (
      <bem.DataStorage>
        <bem.DataStorage__header>
          <h2>{t('Data storage')}</h2>
          <p>{t('Users can collect up to 10,000 survey submissions with their projects each month and store up to 5GB (counted as up to 5,000 Megabytes) overall of survey attachments in their user account (photos, videos, audio recordings, PDF, etc.). If you are reaching any of these limits and you do not want to delete data, please consider upgrading your plan')}</p>
        </bem.DataStorage__header>

        <bem.DataStorage__data>
          <bem.DataRow>
            <bem.DataRow__header>
              {/*TODO: replace icon with proper one from mockups*/}
              <i className={'k-icon k-icon-form-overview'} />
              <label>{t('Submissions per month')}</label>
            </bem.DataRow__header>

            <bem.DataRow__data>
              {/*TODO: Move audio play slider to a custom component and use it in both places*/}
              <input type='range' />
              <KoboDropdown
                theme={KoboDropdownThemes.light}
                isDisabled={false}
                hideOnMenuClick={true}
                menuContent={<p>hello</p>}
                hideOnEsc
                hideOnMenuOutsideClick
                placement={KoboDropdownPlacements['down-left']}
                name='columns-hide-dropdown'
                triggerContent={
                  <span className='columns-hide-dropdown-trigger'>
                    <i className='k-icon k-icon-hide'/>
                    {t('hide fields')}
                  </span>
                }
              />
            </bem.DataRow__data>
          </bem.DataRow>
        </bem.DataStorage__data>
      </bem.DataStorage>
    )
  }
}
