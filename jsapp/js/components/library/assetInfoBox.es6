import React from 'react';
import autoBind from 'react-autobind';
import bem from 'js/bem';
import {
  t,
  formatTime
} from 'js/utils';
import {ASSET_TYPES} from 'js/constants';

class AssetInfoBox extends React.Component {
  constructor(props){
    super(props);
    this.state = {
      areDetailsVisible: false
    };
    autoBind(this);
  }

  componentDidMount() {
    console.debug('AssetInfoBox did mount', this.props);
  }

  toggleDetails() {
    this.setState({areDetailsVisible: !this.state.areDetailsVisible});
  }

  makePublic() {}

  render() {
    if (!this.props.asset) {
      return null;
    }

    return (
      <bem.FormView__cell m='box'>
        <bem.FormView__cell m={['columns', 'padding']}>
          <bem.FormView__cell m={['date', 'column-1']}>
            <bem.FormView__cellLabel>
              {t('Last Modified')}
            </bem.FormView__cellLabel>

            {formatTime(this.props.asset.date_modified)}
          </bem.FormView__cell>

          <bem.FormView__cell m={['questions', 'column-1']}>
            <bem.FormView__cellLabel>
              {t('Questions')}
            </bem.FormView__cellLabel>

            {this.props.asset.summary.row_count || 0}
          </bem.FormView__cell>

          <bem.FormView__cell m={['buttons', 'column-1']}>
            <button
              className='mdl-button mdl-button--raised mdl-button--colored'
              onClick={this.makePublic}
            >
              {t('Make public')}
            </button>
          </bem.FormView__cell>
        </bem.FormView__cell>

        <bem.FormView__cell m={['columns', 'padding', 'bordertop']}>
          <bem.FormView__cell m={['organization', 'column-1']}>
            <bem.FormView__cellLabel>
              {t('Organization')}
            </bem.FormView__cellLabel>

            {this.props.asset.settings.organization || t('n/a')}
          </bem.FormView__cell>

          <bem.FormView__cell m={['tags', 'column-1']}>
            <bem.FormView__cellLabel>
              {t('Tags')}
            </bem.FormView__cellLabel>

            {this.props.asset.settings.tags.join(', ') || t('n/a')}
          </bem.FormView__cell>

          <bem.FormView__cell m={['sector', 'column-1']}>
            <bem.FormView__cellLabel>
              {t('Sector')}
            </bem.FormView__cellLabel>

            {this.props.asset.settings.sector || t('n/a')}
          </bem.FormView__cell>
        </bem.FormView__cell>

        {this.state.areDetailsVisible &&
          <React.Fragment>
            <bem.FormView__cell m={['columns', 'padding', 'bordertop']}>
              <bem.FormView__cell m={['languages', 'column-1']}>
                <bem.FormView__cellLabel>
                  {t('Languages')}
                </bem.FormView__cellLabel>

                langs
              </bem.FormView__cell>

              <bem.FormView__cell m={['description', 'column-2']}>
                <bem.FormView__cellLabel>
                  {t('Description')}
                </bem.FormView__cellLabel>

                {this.props.asset.settings.description || t('n/a')}
              </bem.FormView__cell>
            </bem.FormView__cell>

            <bem.FormView__cell m={['columns', 'padding', 'bordertop']}>
              <bem.FormView__cell m='column-1'>
                <bem.FormView__cellLabel>
                  {t('Owner')}
                </bem.FormView__cellLabel>

                {this.props.asset.owner__username}
              </bem.FormView__cell>

              <bem.FormView__cell m='column-1'>
                <bem.FormView__cellLabel>
                  {t('Member since')}
                </bem.FormView__cellLabel>

                TODO
              </bem.FormView__cell>
            </bem.FormView__cell>
          </React.Fragment>
        }

        <bem.FormView__cell m={['bordertop', 'toggle-details']}>
          <button onClick={this.toggleDetails}>
            {this.state.areDetailsVisible ? <i className='k-icon k-icon-up'/> : <i className='k-icon k-icon-down'/>}
            {this.state.areDetailsVisible ? t('Hide full details') : t('Show full details')}
          </button>
        </bem.FormView__cell>
      </bem.FormView__cell>
    );
  }
}

export default AssetInfoBox;
