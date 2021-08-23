import React from 'react';
import {dataInterface} from 'js/dataInterface';
import bem from 'js/bem';

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
            <bem.Loading>
              <bem.Loading__inner>
                <p>XForm is loading</p>
              </bem.Loading__inner>
            </bem.Loading>
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
