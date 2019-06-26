import React from 'react';
import Reflux from 'reflux';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import alertify from 'alertifyjs';
import bem from 'js/bem';
import stores from 'js/stores';
import actions from 'js/actions';
import {t} from 'js/utils';
import {ASSET_TYPES} from 'js/constants';

class AssetInfoBox extends React.Component {
  constructor(props){
    super(props);
    autoBind(this);
  }

  makePublic() {}

  render() {
    return (
      <bem.FormView__cell m='box'>
        <bem.FormView__cell m={['columns', 'padding']}>
          <bem.FormView__cell m='date'>
            {t('Last Modified')}: n/a
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

        <bem.FormView__cell m={['columns', 'padding']}>
          <bem.FormView__cell m='organization'>
            org
          </bem.FormView__cell>

          <bem.FormView__cell m='tags'>
            tags
          </bem.FormView__cell>

          <bem.FormView__cell m='sector'>
            sector
          </bem.FormView__cell>
        </bem.FormView__cell>
      </bem.FormView__cell>
    );
  }
}

reactMixin(AssetInfoBox.prototype, Reflux.ListenerMixin);

export default AssetInfoBox;
