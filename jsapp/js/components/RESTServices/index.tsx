import DocumentTitle from 'react-document-title'
import type { AssetResponse } from '#/dataInterface'
import RESTServiceLogs from './RESTServiceLogs'
import RESTServicesList from './RESTServicesList'

interface RESTServicesProps {
  asset: AssetResponse
  hookUid: string
}

/**
 * Entry point for a project's REST Services section. It's a simple router
 * between two views: if a `hookUid` is present we're looking at one service's
 * delivery logs; otherwise we show the list of all services. The URL is what
 * decides which one — the parent route passes `hookUid` when it's in the path.
 */
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
