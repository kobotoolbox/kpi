import React from 'react';
import autoBind from 'react-autobind';
import DocumentTitle from 'react-document-title';
import stores from '../stores';
import {AccessDeniedMessage} from 'js/ui';
import RESTServicesList from './RESTServices/RESTServicesList'
import RESTServiceLogs from './RESTServices/RESTServiceLogs'
import {t} from '../utils';

export default class RESTServices extends React.Component {
  constructor(props){
    super(props);
    autoBind(this);
  }

  render() {
    const docTitle = this.props.asset.name || t('Untitled');
    let isSelfOwned = (
      stores.session.currentAccount &&
      stores.session.currentAccount.username &&
      stores.session.currentAccount.username === this.props.asset.owner__username
    );

    return (
      <DocumentTitle title={`${docTitle} | KoboToolbox`}>
        <React.Fragment>
          {!isSelfOwned &&
            <AccessDeniedMessage/>
          }
          {isSelfOwned && this.props.hookUid &&
            <RESTServiceLogs assetUid={this.props.asset.uid} hookUid={this.props.hookUid} />
          }
          {isSelfOwned && !this.props.hookUid &&
            <RESTServicesList assetUid={this.props.asset.uid} />
          }
        </React.Fragment>
      </DocumentTitle>
    );
  }
}
