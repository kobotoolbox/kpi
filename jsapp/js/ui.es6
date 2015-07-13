import React from 'react/addons';
import bem from './bem';
import {t} from './utils';

var ui = {};

ui.SmallInputBox = React.createClass({
  getValue () {
    return this.refs.inp.getDOMNode().value;
  },
  render () {
    return (
        <input type="text" placeholder={this.props.placeholder} ref='inp'
                className="form-control input-sm pull-right" onKeyUp={this.props.onKeyUp} onChange={this.props.onChange} />
      );
  }
});

ui.Panel = React.createClass({
  render () {
    return (
        <bem.uiPanel className={this.props.className} m={this.props.m}>
          <bem.uiPanel__body>
            {this.props.children}
          </bem.uiPanel__body>
        </bem.uiPanel>
      );
  }
});


ui.Modal = React.createClass({
  backdropClick (evt) {
    if (evt.currentTarget === evt.target) {
      this.props.onClose.call(evt);
    }
  },
  renderTitle () {
    if (this.props.small) {
      return (
          <div>
            <h4 className="modal-title">
              {this.props.title}
            </h4>
            <h6>
              {this.props.small}
            </h6>
          </div>
        );
    } else {
      return (
          <h4 className="modal-title">
            {this.props.title}
          </h4>
        );
    }
  },
  render () {
    return (
          <div className='modal-backdrop' style={{backgroundColor: 'rgba(0,0,0,0.3)'}} onClick={this.backdropClick.bind(this)}>
            <div className={this.props.open ? 'modal-open' : 'modal'}>
              <div className="modal-dialog k-modal-dialog">
                <div className="modal-content">
                  <div className="modal-header">
                    <button type="button" className="close" data-dismiss="modal" aria-hidden="true" onClick={this.props.onClose}>×</button>
                    {this.renderTitle()}
                  </div>
                  {this.props.children}
                </div>
              </div>
            </div>
          </div>
        );
  }
});

ui.Modal.Footer = React.createClass({
  render () {
    return <div className="modal-footer">{this.props.children}</div>;
  }
})

ui.Modal.Body = React.createClass({
  render () {
    return <div className="modal-body">{this.props.children}</div>;
  }
});


ui.Breadcrumb = React.createClass({
  render () {
    return (
        <ul className="ui-breadcrumb">
          {this.props.children}
        </ul>
      );
  }
});

ui.BreadcrumbItem = React.createClass({
  render () {
    return (
        <li className="ui-breadcrumb__item">
          {this.props.children}
        </li>
      );
  }
});

ui.AssetName = React.createClass({
  render () {
    var name = this.props.name,
        extra = false;
    var summary = this.props.summary;
    if (!name) {
      name = summary.labels ? summary.labels[0] : t('empty');
      if (summary.labels && summary.labels.length === 2) {
        extra = <small>{t('and one other question')}</small>;
      } else if (summary.labels.length > 2) {
        extra = <small>{t('and ## other questions').replace('##', summary.labels.length-1)}</small>;
      }
    }
    return (
        <span className="asset-name">
          {name}
          {extra ?
            extra
          :null }
        </span>
      );
  }
});

export default ui;