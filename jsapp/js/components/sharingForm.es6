import React from 'react';
import ReactDOM from 'react-dom';
import Reflux from 'reflux';
import TagsInput from 'react-tagsinput';
import stores from '../stores';
import actions from '../actions';
import mixins from '../mixins';
import classNames from 'classnames';
import Select from 'react-select';
import bem from '../bem';
import {
  t, 
  parsePermissions, 
  getAnonymousUserPermission,
  stringToColor,
  anonUsername
} from '../utils';

var availablePermissions = [
  {value: 'view', label: t('Can View')},
  {value: 'change', label: t('Can Edit')},
  {value: 'view_submissions', label: t('Can View Submissions')},
  {value: 'add_submissions', label: t('Can Add Submissions')},
  {value: 'change_submissions', label: t('Can Edit Submissions')}
];


var UserPermDiv = React.createClass({
  removePermissions() {
    // removing view permission will include all other permissions
    actions.permissions.removePerm({
      permission_url: this.props.can.view.url,
      content_object_uid: this.props.uid
    });
  },
  render () {
    var initialsStyle = {
      background: `#${stringToColor(this.props.username)}`
    };

    var cans = [];
    for(var key in this.props.can) {
      var perm = availablePermissions.find(function (d) {return d.value === key}).label;
      cans.push(perm);
    }

    return (
      <bem.UserRow m={cans.length > 0 ? 'regular' : 'deleted'}>
        <bem.UserRow__avatar>
          <bem.AccountBox__initials style={initialsStyle}>
            {this.props.username.charAt(0)}
          </bem.AccountBox__initials>
        </bem.UserRow__avatar>
        <bem.UserRow__name>
          {this.props.username}
        </bem.UserRow__name>
        <bem.UserRow__role title={cans.join(', ')}>
          {cans.join(', ')}
        </bem.UserRow__role>
        <bem.UserRow__cancel onClick={this.removePermissions}>
          <i className="k-icon k-icon-trash" />
        </bem.UserRow__cancel>
      </bem.UserRow>      
      );
  }
});

var PublicPermDiv = React.createClass({
  togglePerms() {
    if (this.props.publicPerm) {
      actions.permissions.removePerm({
        permission_url: this.props.publicPerm.url,
        content_object_uid: this.props.uid
      });
    } else {
      actions.permissions.assignPerm({
        username: anonUsername,
        uid: this.props.uid,
        kind: this.props.kind,
        objectUrl: this.props.objectUrl,
        role: 'view'
      });
    }
  },
  render () {
    var uid = this.props.uid;

    var href = `#/forms/${uid}`;
    var url = `${window.location.protocol}//${window.location.host}/${href}`;

    return (
      <bem.FormModal__item m='perms-link'>
        <input  type="checkbox" 
                checked={this.props.publicPerm ? true : false} 
                onChange={this.togglePerms} 
                id="share-by-link"/>
        <label htmlFor="share-by-link">{t('Share by link')}</label>
        { this.props.publicPerm && 
          <bem.FormModal__item m='shareable-link'>
            <label>
              {t('Shareable link')}
            </label>
            <input type="text" value={url} readOnly />
          </bem.FormModal__item>
        }
      </bem.FormModal__item>
    );
  }
});

var SharingForm = React.createClass({
  mixins: [
    mixins.contextRouter,
    Reflux.ListenerMixin
  ],
  assetChange (data) {
    var uid = this.props.uid || this.currentAssetID(),
      asset = data[uid];

    if (asset) {
      this.setState({
        asset: asset,
        permissions: asset.permissions,
        owner: asset.owner__username,
        pperms: parsePermissions(asset.owner__username, asset.permissions),
        public_permission: getAnonymousUserPermission(asset.permissions),
        related_users: stores.asset.relatedUsers[uid]
      });
    }
  },
  componentDidMount () {
    this.listenTo(stores.userExists, this.userExistsStoreChange);
    if (this.props.uid) {
      actions.resources.loadAsset({id: this.props.uid});
    }
    this.listenTo(stores.asset, this.assetChange);
  },
  userExistsStoreChange (checked, result) {
    var inpVal = this.usernameFieldValue();
    if (inpVal === result) {
      var newStatus = checked[result] ? 'success' : 'error';
      this.setState({
        userInputStatus: newStatus
      });
    }
  },
  usernameField () {
    return ReactDOM.findDOMNode(this.refs.usernameInput);
  },
  usernameFieldValue () {
    return this.usernameField().value;
  },
  usernameCheck (evt) {
    var username = evt.target.value;
    if (username && username.length > 1) {
      var result = stores.userExists.checkUsername(username);
      if (result === undefined) {
        actions.misc.checkUsername(username);
      } else {
        log(result ? 'success' : 'error');
        this.setState({
          userInputStatus: result ? 'success' : 'error'
        });
      }
    } else {
      this.setState({
        userInputStatus: false
      });
    }
  },
  getInitialState () {
    return {
      userInputStatus: false,
      permInput: 'view'
    };
  },
  addInitialUserPermission (evt) {
    evt.preventDefault();
    var username = this.usernameFieldValue();
    if (stores.userExists.checkUsername(username)) {
      actions.permissions.assignPerm({
        username: username,
        uid: this.state.asset.uid,
        kind: this.state.asset.kind,
        objectUrl: this.props.objectUrl,
        role: this.state.permInput
      });
      this.usernameField().value = '';
    }
  },
  updatePermInput(permName) {
    this.setState({
      permInput: permName.value
    });
  },
  render () {
    var inpStatus = this.state.userInputStatus;
    if (!this.state.pperms) {
      return (
          <bem.Loading>
            <bem.Loading__inner>
              <i />
              {t('loading...')}
            </bem.Loading__inner>
          </bem.Loading>
        );
    }
    var _perms = this.state.pperms;
    var perms = this.state.related_users.map(function(username){
      var currentPerm = _perms.filter(function(p){
        return p.username === username;
      })[0];
      if (currentPerm) {
        return currentPerm;
      } else {
        return {
          username: username,
          can: {}
        };
      }
    });

    var btnKls = classNames('mdl-button','mdl-js-button', 'mdl-button--raised', inpStatus === 'success' ? 'mdl-button--colored' : 'mdl-button--disabled');

    var uid = this.state.asset.uid;
    var kind = this.state.asset.kind;
    var asset_type = this.state.asset.asset_type;
    var objectUrl = this.state.asset.url;

    if (!perms) {
      return (
          <p>loading</p>
        );
    }

    var initialsStyle = {
      background: `#${stringToColor(this.state.asset.owner__username)}`
    };

    return (
      <bem.FormModal>
        <bem.FormModal__item>
          <bem.FormView__cell m='label'>
            {t('Who has access')}
          </bem.FormView__cell>
          <bem.UserRow>
            <bem.UserRow__avatar>
              <bem.AccountBox__initials style={initialsStyle}>
                {this.state.asset.owner__username.charAt(0)}
              </bem.AccountBox__initials>
            </bem.UserRow__avatar>
            <bem.UserRow__name>
              <div>{this.state.asset.owner__username}</div>
            </bem.UserRow__name>
            <bem.UserRow__role>{t('is owner')}</bem.UserRow__role>
          </bem.UserRow>

          {perms.map((perm)=> {
            return <UserPermDiv key={`perm.${uid}.${perm.username}`} ref={perm.username} uid={uid} kind={kind} objectUrl={objectUrl} {...perm} />;
          })}

        </bem.FormModal__item>

        <bem.FormModal__form onSubmit={this.addInitialUserPermission} className="sharing-form__user">
            <bem.FormView__cell m='label'>
              {t('Invite collaborators')}
            </bem.FormView__cell>
            <bem.FormModal__item m='perms-user'>
              <input type="text"
                  id="permsUser" 
                  ref='usernameInput'
                  placeholder={t('Enter a username')}
                  onKeyUp={this.usernameCheck}
                  onChange={this.usernameCheck}
              />
              <Select
                  id='permGiven'
                  ref='permInput'
                  value={this.state.permInput}
                  clearable={false}
                  options={availablePermissions}
                  onChange={this.updatePermInput}
              />
              <button className={btnKls}>
                  {t('invite')}
              </button>
          </bem.FormModal__item>
        </bem.FormModal__form>

        { kind != 'collection' && asset_type == 'survey' && 
          <bem.FormView__cell>
            <bem.FormView__cell m='label'>
              {t('Select share settings')}
            </bem.FormView__cell>
            <PublicPermDiv 
              uid={uid}
              publicPerm={this.state.public_permission}
              kind={kind}
              objectUrl={objectUrl}
            />
          </bem.FormView__cell>
        }
      </bem.FormModal>
    );
  }
});

export default SharingForm;
