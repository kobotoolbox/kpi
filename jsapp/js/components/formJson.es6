import React from 'react';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import {actions} from 'js/actions';
import {stores} from 'js/stores';
import bem from 'js/bem';

export default class FormJson extends React.Component {
  constructor(props) {
    super(props);
    this.state = {assetContent: false};
    autoBind(this);
  }

  componentDidMount() {
    this.listenTo(stores.asset, this.assetStoreTriggered);
    const uid = this.props.params.assetid || this.props.params.uid;
    actions.resources.loadAsset({id: uid});
  }

  assetStoreTriggered(data, uid) {
    this.setState({assetContent: data[uid].content});
  }

  render() {
    let content = null;
    if (this.state.assetContent) {
      content = JSON.stringify(this.state.assetContent, null, 4);
    }

    return (
      <bem.uiPanel>
        <bem.uiPanel__body>
          <bem.FormView>
            <pre>
              <code>
                {content}
              </code>
            </pre>
          </bem.FormView>
        </bem.uiPanel__body>
      </bem.uiPanel>
    );
  }
}

reactMixin(FormJson.prototype, Reflux.ListenerMixin);
