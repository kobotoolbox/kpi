import React from 'react'

export default class DataStorage extends React.Component {
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
      // TODO: Temporary placeholder to merge usage dashboard seprately from MFA
      <h1>TBD Usage dash</h1>
    );
  }
}
