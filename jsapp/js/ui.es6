import React from 'react/addons';
import bem from './bem';
import {t, newId} from './utils';

var ui = {};

ui.SmallInputBox = React.createClass({
  getValue () {
    return this.refs.inp.getDOMNode().value;
  },
  render () {
    const id = newId();
    return (
        <div className="mdl-textfield mdl-js-textfield mdl-textfield--full-width">
            <input type="text" ref='inp' className="mdl-textfield__input" 
                onKeyUp={this.props.onKeyUp} onChange={this.props.onChange} id={id} />
              <label className="mdl-textfield__label" htmlFor={id} >{this.props.placeholder}</label>
        </div>
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
        extra = false,
        isEmpty;
    var summary = this.props.summary;
    var row_count;
    if (!name) {
      row_count = summary.row_count;
      name = summary.labels ? summary.labels[0] : false;
      if (!name) {
        isEmpty = true;
        name = t('empty');
      }
      if (row_count) {
        if (row_count === 2) {
          extra = <small>{t('and one other question')}</small>;
        } else if (row_count > 2) {
          extra = <small>{t('and ## other questions').replace('##', row_count-1)}</small>;
        }
      }
    }
    return (
        <span className={isEmpty ? 'asset-name asset-name--empty' : 'asset-name'}>
          {name}
          {extra ?
            extra
          :null }
        </span>
      );
  }
});

export default ui;