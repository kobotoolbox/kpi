import DocumentTitle from 'react-document-title'
import type { AssetResponse } from '#/dataInterface'
import RESTServiceLogs from './RESTServiceLogs'
import RESTServicesList from './RESTServicesList'

interface RESTServicesProps {
  asset: AssetResponse
  hookUid: string
}

export default function RESTServices({ asset, hookUid }: RESTServicesProps) {
  const docTitle = asset.name || t('Untitled')
  return (
    <DocumentTitle title={`${docTitle} | KoboToolbox`}>
      <div className='rest-services form-view form-view--rest-services'>
        {hookUid && <RESTServiceLogs assetUid={asset.uid} hookUid={hookUid} />}
        {!hookUid && <RESTServicesList assetUid={asset.uid} />}
      </div>
    </DocumentTitle>
  )
}
