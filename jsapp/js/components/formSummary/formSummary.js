import React from 'react';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import { Link, NavLink } from 'react-router-dom';
import mixins from 'js/mixins';
import bem from 'js/bem';
import DocumentTitle from 'react-document-title';
import Icon from 'js/components/common/icon';
import Avatar from 'js/components/common/avatar';
import {getFormDataTabs} from 'js/components/formViewSideTabs';
import {getUsernameFromUrl, ANON_USERNAME} from 'js/users/utils';
import {MODAL_TYPES} from 'js/constants';
import './formSummary.scss';
import {userCan} from 'js/components/permissions/utils';
import FormSummaryProjectInfo from './formSummaryProjectInfo';
import SubmissionsCountGraph from 'js/project/submissionsCountGraph.component';
import pageState from 'js/pageState.store';

class FormSummary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
    autoBind(this);
  }

  renderQuickLinks() {
    return (
      <bem.FormView__cell m='data-tabs'>
        {userCan('add_submissions', this.state) &&
          <Link
            to={`/forms/${this.state.uid}/landing`}
            key='landing'
            data-path={`/forms/${this.state.uid}/landing`}
            onClick={this.triggerRefresh}
          >
              <i className='k-icon k-icon-projects' />
              {t('Collect data')}
              <Icon name='angle-right' size='s'/>
          </Link>
        }

        {userCan('change_asset', this.state) &&
          <button onClick={this.sharingModal}>
            <i className='k-icon k-icon-user-share'/>
            {t('Share project')}
            <Icon name='angle-right' size='s'/>
          </button>
        }

        {userCan('change_asset', this.state) &&
          <Link
            to={`/forms/${this.state.uid}/edit`}
            key='edit'
            data-path={`/forms/${this.state.uid}/edit`}
            onClick={this.triggerRefresh}
            data-cy="edit"
          >
            <i className='k-icon k-icon-edit' />
            {t('Edit form')}
            <Icon name='angle-right' size='s'/>
          </Link>
        }

        <button onClick={this.enketoPreviewModal}>
          <i className='k-icon k-icon-view' />
          {t('Preview form')}
          <Icon name='angle-right' size='s'/>
        </button>
      </bem.FormView__cell>
    );
  }

  renderDataTabs() {
    if (!this.state.permissions || !userCan('view_submissions', this.state)) {
      return null;
    }

    if (this.state.deployment__submission_count < 1) {
      return null;
    }

    const sideTabs = getFormDataTabs(this.state.uid);

    return (
      <bem.FormView__row m='data-links'>
        <bem.FormView__cell m={['label', 'first']}>
          {t('Data')}
        </bem.FormView__cell>
        <bem.FormView__cell m='box'>
          <bem.FormView__cell m='data-tabs'>
            {sideTabs.map((item, ind) =>
              <NavLink
                to={item.path}
                key={ind}
                data-path={item.path}
                onClick={this.triggerRefresh}
              >
                <i className={`k-icon ${item.icon}`} />
                {item.label}
                <Icon name='angle-right' size='s'/>
              </NavLink>
            )}
          </bem.FormView__cell>
        </bem.FormView__cell>
      </bem.FormView__row>
    );
  }

  sharingModal (evt) {
    evt.preventDefault();
    pageState.showModal({
      type: MODAL_TYPES.SHARING,
      assetid: this.state.uid,
    });
  }

  enketoPreviewModal (evt) {
    evt.preventDefault();
    pageState.showModal({
      type: MODAL_TYPES.ENKETO_PREVIEW,
      assetid: this.state.uid,
    });
  }

  renderTeam() {
    const team = [];
    this.state.permissions?.forEach((perm) => {
      let username = null;
      if (perm.user) {
        username = getUsernameFromUrl(perm.user);
      }

      if (username && !team.includes(username) && username !== ANON_USERNAME) {
        team.push(username);
      }
    });

    if (team.length < 2) {
      return false;
    }

    return (
      <bem.FormView__row m='team'>
        <bem.FormView__cell m={['label', 'first']}>
          {t('Team members')}
        </bem.FormView__cell>
        {userCan('change_asset', this.state) &&
          <a onClick={this.sharingModal} className='team-sharing-button'>
            <i className='k-icon k-icon-user-share' />
          </a>
        }
        <bem.FormView__cell m={['box', 'padding']}>
          { team.map((username, ind) =>
            <Avatar
              key={ind}
              username={username}
              size='s'
              isUsernameVisible
            />
          )}
        </bem.FormView__cell>
      </bem.FormView__row>
    );
  }

  render () {
    const docTitle = this.state.name || t('Untitled');

    return (
      <DocumentTitle title={`${docTitle} | KoboToolbox`}>
        <bem.FormView m='summary'>
          <bem.FormView__column m='left'>
            {/* We only want to pass an actual asset object, but because this
            component uses `mixins.dmix`, we have to add this little check. */}
            {this.state.uid &&
              <FormSummaryProjectInfo asset={this.state}/>
            }

            {this.state.uid &&
              <bem.FormView__row>
                <bem.FormView__cell m={['label', 'first']}>
                  {t('Submissions')}
                </bem.FormView__cell>

                <bem.FormView__cell m='box'>
                  <SubmissionsCountGraph assetUid={this.state.uid}/>
                </bem.FormView__cell>
              </bem.FormView__row>
            }
          </bem.FormView__column>

          <bem.FormView__column m='right'>
            <bem.FormView__row m='quick-links'>
              <bem.FormView__cell m={['label', 'first']}>
                {t('Quick Links')}
              </bem.FormView__cell>
              <bem.FormView__cell m='box'>
                {this.renderQuickLinks()}
              </bem.FormView__cell>
            </bem.FormView__row>

            {this.renderDataTabs()}

            {this.renderTeam()}

          </bem.FormView__column>
        </bem.FormView>
      </DocumentTitle>
      );
  }

}

reactMixin(FormSummary.prototype, mixins.dmix);
reactMixin(FormSummary.prototype, Reflux.ListenerMixin);

export default FormSummary;
