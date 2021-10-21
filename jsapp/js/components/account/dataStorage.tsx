import React from 'react'
import bem, {makeBem} from 'js/bem'
import KoboDropdown, {
  KoboDropdownThemes,
  KoboDropdownPlacements,
} from 'js/components/common/koboDropdown'
import Icon from 'js/components/common/icon'
import KoboRange from 'js/components/common/koboRange'
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

const MAX_MONTHLY_SUBMISSIONS = 10000
const PLACEHOLDER = 3407 // TODO remove this once endpoint exists

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
              <div className='submissions-title-wrapper'>
                <Icon name='form-overview' size='m'/>
                <label>{t('Submissions per month')}</label>
              </div>

              <div className='submissions-hint-wrapper'>
                {/*TODO: replace icon with proper one from mockups*/}
                <Icon name='spinner' size='xs'/>
                <label className='count'>
                  {/*TODO: change this placeholder when endpoint is done*/}
                  {t('Count will reset in ##DAYS_TO_RESET## days')
                    .replace('##DAYS_TO_RESET##', '6')}
                </label>
              </div>
            </bem.DataRow__header>

            <bem.DataRow__data>
              <KoboRange
                max={MAX_MONTHLY_SUBMISSIONS - PLACEHOLDER}
                value={PLACEHOLDER}
                currentLabel={t('submissions collected this month')}
                totalLabel={t('submissions left')}
                // TODO: when endpoint exists, change this to warning after some percentage has passed
                color='teal'
              />
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
                    {t('see details')}
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
