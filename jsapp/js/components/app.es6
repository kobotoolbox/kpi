import React from 'react';
import $ from 'jquery';
import Router from 'react-router';
import {Sidebar} from './sidebar';
import {log} from './utils';

var DefaultRoute = Router.DefaultRoute;
var Link = Router.Link;
var Route = Router.Route;
var RouteHandler = Router.RouteHandler;

class SmallInputBox extends React.Component {
  render () {
    return (
        <input type="text" placeholder={this.props.placeholder}
                className="form-control input-sm pull-right" />
      );
  }
}

class AssetCollectionsTable extends React.Component {
  constructor () {
    super();
    this.state = {
      loading: 'your assets will load shortly'
    };
  }
  componentDidMount () {
    $.getJSON(this.props.source, (result) => {
      this.setState(result);
    });
  }

  render () {
    var rows; 
    var title = 'Asset Collections';
    if (this.state.results && this.state.results.length == 0) {
      rows = (
        <AssetCollectionPlaceholder notice={'there are no surveys to display'} />
        );
    } else if (this.state.results && this.state.results.length > 0) {
      rows = this.state.results.map((asset) => {
        return <AssetCollectionRow {...asset} />;
      });
    } else {
      rows = (
        <AssetCollectionPlaceholder {...this.state} />
        );
    }
    return (
        <div className="widget asset-collections-table">
          <div className="widget-title">
            <i className="fa fa-fighter-jet"></i> {title}
            <SmallInputBox placeholder={'Search'} />
            <div className="clearfix"></div>
          </div>
          <div className="widget-body no-padding">
            <div className="table-responsive">
              <table className="table">
                <tbody>
                  {rows}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )
  }
}

class AssetCollectionRow extends React.Component {
  render () {
    var icon_cls = "fa-stack fa-fw fa-lg asset--type-"+this.props.assetType
    return (
        <tr className="assetcollection__row">
          <td className="text-center asset-icon-box">
            <span className={icon_cls}>
              <i className="fa fa-circle fa-lg"></i>
            </span>
          </td>
          <td>
            <a href={this.props.username}>Owner</a>
          </td>
          <td>
            <a href={this.props.url}>{this.props.name || 'untitled'}</a>
            <AssetTags tags={this.props.tags} />
          </td>
          <td>
            {this.props.id || '?'}
          </td>
          <td>
            <a href="#">
              <i className="fa fa-fw fa-ellipsis-v" />
            </a>
          </td>
        </tr>
      )
  }
}

class AssetCollectionPlaceholder extends React.Component {
  render () {
    var icon,
        message,
        clName = "assetcollection__row";
    if (this.props.loading) {
      icon = <img src={'/static/img/ajax-loader.gif'} width="14" height="14" />;
      message = this.props.loading;
      clName += " assetcollection__row--loading";
    } else if(this.props.notice) {
      message = this.props.notice;
      icon = <i className="fa fa-fw fa-notice" />;
      clName += " assetcollection__row--notice";
    } else {
      message = this.props.error;
      icon =  <i className="fa fa-fw fa-warning" />;
      clName += " assetcollection__row--error";
    }
    return (
        <tr className={clName}>
          <td colSpan="4">{icon}&nbsp;&nbsp;{message}</td>
        </tr>
      )
  }
}

class AssetTags extends React.Component {
  render () {
    var tags = this.props.tags.map((t)=> {
      return <span className="assettag">{t}</span>
    });
    return (
      <span className="assettags">{tags}</span>
      );
  }
}

class App extends React.Component {
  constructor () {
    super();
    this.resize = this.handleResize.bind(this);
    this.state = {
      intentOpen: true,
      isOpen: !this.widthLessThanMin()
    };
  }

  widthLessThanMin () {
    return window.innerWidth < 560;
  }

  handleResize () {
    if (this.widthLessThanMin()) {
      this.setState({
        isOpen: false
      });
    } else if (this.state.intentOpen && !this.state.isOpen) {
      this.setState({
        isOpen: true
      });
    }
  }

  componentDidMount () {
    // can use window.matchMedia(...) here
    window.addEventListener('resize', this.resize);
  }
  componentWillUnmount () {
    window.removeEventListener('resize', this.resize);
  }

  toggleIntentOpen () {
    if (this.state.intentOpen) {
      this.setState({
        intentOpen: false,
        isOpen: false
      })
    } else {
      this.setState({
        intentOpen: true,
        isOpen: true
      });
    }
  }

  render() {
    var activeClass = this.state.isOpen ? 'active' : '';
    return (
      <div id="page-wrapper" className={activeClass}>
        <Sidebar toggleIntentOpen={this.toggleIntentOpen.bind(this)} />
        <ContentBox page="apiRoot" />
        <RouteHandler />
      </div>
    )
  }
}

class ContentBox extends React.Component {
  render () {
    return (
        <div id="content-wrapper" className="page-content contentbox row">
          <PageHeader />
          <div className="row">
            <AssetCollectionsTable source="/survey_assets/" />
          </div>
        </div>
      )
  }
}
class PageHeader extends React.Component {
  render () {
    return (
        <div className="row header">
          <div className="col-xs-12">
            <div className="meta pull-left">
              <div className="page">
                Dashboard
              </div>
              <div className="breadcrumb-links">
                Home / Dashboard
              </div>
            </div>
          </div>
        </div>
      )
  }
}

class Dashboard extends React.Component {
  render() {
    return (
      <p className="hushed">dashboard</p>
    );
  }
}


var routes = (
  <Route name="app" path="/" handler={App}>
    <DefaultRoute handler={Dashboard} />
    <Route name="help" path="/help" handler={App} />
  </Route>
);

export function runRoutes(el) {
  Router.run(routes, function (Handler, state) {
    // log(state)
    // --> {"path":"/","action":null,"pathname":"/","routes": [...],"params":{},"query":{}}
    window._state = state;
    React.render(<Handler />, el);
  });
};