import React from 'react';
import autoBind from 'react-autobind';
import DocumentTitle from 'react-document-title';
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
    return (
      <DocumentTitle title={`${docTitle} | KoboToolbox`}>
        <React.Fragment>
          {this.props.hookUid &&
            <RESTServiceLogs assetUid={this.props.asset.uid} hookUid={this.props.hookUid} />
          }
          {!this.props.hookUid &&
            <RESTServicesList assetUid={this.props.asset.uid} />
          }
        </React.Fragment>
      </DocumentTitle>
    );
  }
}
