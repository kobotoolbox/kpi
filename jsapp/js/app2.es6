import React from 'react';
import { Router, Route, browserHistory, IndexRoute } from 'react-router';

var Home = React.createClass({
  render () {
    return (
      <ui.Panel className="k-div--home">
        <h1>Home</h1>
        <hr />
        Please log in and click "forms"
      </ui.Panel>
      );
  }
});

export default Home;

class App extends React.Component {
  render() {
  	console.log(this.props);
    return (
    	<h1> testing </h1>
    );
  }
}

export default App;

