import React from 'react'

export default class Security extends React.Component<
  {}, {}
> {
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
