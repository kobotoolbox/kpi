import React from 'react';
import autoBind from 'react-autobind';
import DocumentTitle from 'react-document-title';
import bem from '../bem';
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
    if (this.props.hookUid) {
      return (
        <DocumentTitle title={`${docTitle} | KoboToolbox`}>
          <bem.FormView m={'form-settings'} className='rest-services'>
            <RESTServiceLogs assetUid={this.props.asset.uid} hookUid={this.props.hookUid} />
          </bem.FormView>
        </DocumentTitle>
      );
    } else {
      return (
        <DocumentTitle title={`${docTitle} | KoboToolbox`}>
          <RESTServicesList assetUid={this.props.asset.uid} />
        </DocumentTitle>
      );
    }
  }
};
