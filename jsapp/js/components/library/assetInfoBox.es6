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
          <bem.FormView__cell m='date'>
            {t('Last Modified')}: {formatTime(this.props.asset.date_modified)}
          </bem.FormView__cell>

          <bem.FormView__cell m='questions'>
            {t('Questions')}: 0
          </bem.FormView__cell>

          <bem.FormView__cell m='buttons'>
            <button
              className='mdl-button mdl-button--raised mdl-button--colored'
              onClick={this.makePublic}
            >
              {t('Make public')}
            </button>
          </bem.FormView__cell>
        </bem.FormView__cell>

        <bem.FormView__cell m={['columns', 'padding', 'bordertop']}>
          <bem.FormView__cell m='organization'>
            {this.props.asset.settings.organization}
          </bem.FormView__cell>

          <bem.FormView__cell m='tags'>
            {this.props.asset.settings.organization.tags}
          </bem.FormView__cell>

          <bem.FormView__cell m='sector'>
            {this.props.asset.settings.organization.sector}
          </bem.FormView__cell>
        </bem.FormView__cell>

        <bem.FormView__cell m={['columns', 'padding', 'bordertop']}>
          <bem.FormView__cell m='languages'>
            languages
          </bem.FormView__cell>

          <bem.FormView__cell m='description'>
            {this.props.asset.settings.description}
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
