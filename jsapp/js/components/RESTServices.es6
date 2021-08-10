import React from 'react';
import autoBind from 'react-autobind';
import DocumentTitle from 'react-document-title';
import mixins from 'js/mixins';
import {PERMISSIONS_CODENAMES} from 'js/constants';
import AccessDeniedMessage from 'js/components/common/accessDeniedMessage';
import RESTServicesList from './RESTServices/RESTServicesList';
import RESTServiceLogs from './RESTServices/RESTServiceLogs';
import './RESTServices.scss';

export default class RESTServices extends React.Component {
  constructor(props){
    super(props);
    autoBind(this);
  }

  render() {
    const docTitle = this.props.asset.name || t('Untitled');
    let hasAccess = (
      mixins.permissions.userCan(PERMISSIONS_CODENAMES.view_submissions, this.props.asset) &&
      mixins.permissions.userCan(PERMISSIONS_CODENAMES.change_asset, this.props.asset)
    );

    return (
      <DocumentTitle title={`${docTitle} | KoboToolbox`}>
        <React.Fragment>
          {!hasAccess &&
            <AccessDeniedMessage/>
          }
          {hasAccess && this.props.hookUid &&
            <RESTServiceLogs assetUid={this.props.asset.uid} hookUid={this.props.hookUid} />
          }
          {hasAccess && !this.props.hookUid &&
            <RESTServicesList assetUid={this.props.asset.uid} />
          }
        </React.Fragment>
      </DocumentTitle>
    );
  }
}
