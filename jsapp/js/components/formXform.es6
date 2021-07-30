import React from 'react';
import {dataInterface} from 'js/dataInterface';
import {bem} from 'js/bem';
import ui from 'js/ui';

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
        <ui.Panel>
          <bem.Loading>
            <bem.Loading__inner>
              <p>XForm is loading</p>
            </bem.Loading__inner>
          </bem.Loading>
        </ui.Panel>
      );
    } else {
      return (
        <ui.Panel>
          <bem.FormView>
            <div
              className='pygment'
              dangerouslySetInnerHTML={this.state.xformHtml}
            />
          </bem.FormView>
        </ui.Panel>
      );
    }
  }
}
