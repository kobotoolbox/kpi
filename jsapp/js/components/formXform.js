import React from 'react'

import bem from '#/bem'
import CenteredMessage from '#/components/common/centeredMessage.component'
import { dataInterface } from '#/dataInterface'

export default class FormXform extends React.Component {
  constructor(props) {
    super(props)
    this.state = { xformLoaded: false }
  }

  componentDidMount() {
    const uid = this.props.params.assetid || this.props.params.uid
    dataInterface.getAssetXformView(uid).done((content) => {
      this.setState({
        xformLoaded: true,
        xformHtml: { __html: $('<div>').html(content).find('.pygment').html() },
      })
    })
  }

  render() {
    if (this.state.xformLoaded) {
      return (
        <bem.FormView m='ui-panel'>
          <div className='pygment' dangerouslySetInnerHTML={this.state.xformHtml} />
        </bem.FormView>
      )
    } else {
      return (
        <bem.FormView m='ui-panel'>
          <CenteredMessage message={t('XForm is loading')} />
        </bem.FormView>
      )
    }
  }
}
