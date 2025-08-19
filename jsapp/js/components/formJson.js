import React from 'react'

import autoBind from 'react-autobind'
import reactMixin from 'react-mixin'
import Reflux from 'reflux'
import { actions } from '#/actions'
import assetStore from '#/assetStore'
import bem from '#/bem'

export default class FormJson extends React.Component {
  constructor(props) {
    super(props)
    this.state = { assetContent: false }
    autoBind(this)
  }

  componentDidMount() {
    this.listenTo(assetStore, this.assetStoreTriggered)
    const uid = this.props.params.assetid || this.props.params.uid
    actions.resources.loadAsset({ id: uid })
  }

  assetStoreTriggered(response) {
    const { content } = Object.values(response)[0]
    this.setState({ assetContent: content })
  }

  render() {
    let content = null
    if (this.state.assetContent) {
      content = JSON.stringify(this.state.assetContent, null, 4)
    }

    return (
      <bem.FormView m='ui-panel'>
        <pre>
          <code>{content}</code>
        </pre>
      </bem.FormView>
    )
  }
}

reactMixin(FormJson.prototype, Reflux.ListenerMixin)
