import './RESTServices.scss'

import React from 'react'

import DocumentTitle from 'react-document-title'
import type { AssetResponse } from '#/dataInterface'
import RESTServiceLogs from './RESTServiceLogs'
import RESTServicesList from './RESTServicesList'

interface RESTServicesProps {
  asset: AssetResponse
  hookUid: string
}

export default class RESTServices extends React.Component<RESTServicesProps> {
  render() {
    const docTitle = this.props.asset.name || t('Untitled')
    return (
      <DocumentTitle title={`${docTitle} | KoboToolbox`}>
        <React.Fragment>
          {this.props.hookUid && <RESTServiceLogs assetUid={this.props.asset.uid} hookUid={this.props.hookUid} />}
          {!this.props.hookUid && <RESTServicesList assetUid={this.props.asset.uid} />}
        </React.Fragment>
      </DocumentTitle>
    )
  }
}
