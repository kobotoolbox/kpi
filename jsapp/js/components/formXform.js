import React from 'react';
import {dataInterface} from 'js/dataInterface';
import bem from 'js/bem';
import CenteredMessage from 'js/components/common/centeredMessage.component';

export default class FormXform extends React.Component {
  constructor(props) {
    super(props);
    this.state = {xformLoaded: false};
  }

  componentDidMount() {
    const uid = this.props.params.assetid || this.props.params.uid;
    dataInterface.getAssetXformView(uid).done((content) => {
      this.setState({
        xformLoaded: true,
        xformHtml: {__html: $('<div>').html(content).find('.pygment').html()},
      });
    });
  }

  render() {
    if (!this.state.xformLoaded) {
      return (
        <bem.uiPanel>
          <bem.uiPanel__body>
            <CenteredMessage message={t('XForm is loading')} />
          </bem.uiPanel__body>
        </bem.uiPanel>
      );
    } else {
      return (
        <bem.uiPanel>
          <bem.uiPanel__body>
            <bem.FormView>
              <div
                className='pygment'
                dangerouslySetInnerHTML={this.state.xformHtml}
              />
            </bem.FormView>
          </bem.uiPanel__body>
        </bem.uiPanel>
      );
    }
  }
}
