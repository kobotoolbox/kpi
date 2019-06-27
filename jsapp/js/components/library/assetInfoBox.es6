import React from 'react';
import Reflux from 'reflux';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import alertify from 'alertifyjs';
import bem from 'js/bem';
import stores from 'js/stores';
import actions from 'js/actions';
import {
  t,
  formatTime
} from 'js/utils';
import {ASSET_TYPES} from 'js/constants';

class AssetInfoBox extends React.Component {
  constructor(props){
    super(props);
    autoBind(this);

    console.debug('AssetInfoBox', this.props);
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
          <bem.FormView__cell m='owner'>
            owner {this.props.asset.owner__username}
          </bem.FormView__cell>
        </bem.FormView__cell>
      </bem.FormView__cell>
    );
  }
}

reactMixin(AssetInfoBox.prototype, Reflux.ListenerMixin);

export default AssetInfoBox;
