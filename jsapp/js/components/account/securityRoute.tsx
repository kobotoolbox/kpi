import React from 'react'
import bem, {makeBem} from 'js/bem'

bem.Security = makeBem(null, 'data-storage')

bem.SecurityRow = makeBem(null, 'security-row')
bem.SecurityRow__header = makeBem(bem.SecurityRow, 'header')
bem.SecurityRow__title = makeBem(bem.SecurityRow, 'title')
bem.SecurityRow__buttons = makeBem(bem.SecurityRow, 'buttons')
bem.SecurityRow__description = makeBem(bem.SecurityRow, 'description')

export default class Security extends React.Component {
  constructor(props: any) {
    super(props)
    this.state = {
      isLoading: true,
    }
  }

  componentDidMount() {
    this.setState({
      isLoading: false,
    })
  }

  render() {
    return (
      // TODO: Temporary placeholder to merge security with MFA
      <h1>TBD Security</h1>
    );
  }
}
