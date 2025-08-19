import React from 'react'

import DocumentTitle from 'react-document-title'
import bem from '#/bem'
import AssetsTable from '#/components/assetsTable/assetsTable'
import { AssetsTableContextName } from '#/components/assetsTable/assetsTableConstants'
import { ROOT_BREADCRUMBS } from '#/components/library/libraryConstants'
import type { OrderDirection } from '#/projects/projectViews/constants'
import publicCollectionsStore from './publicCollectionsStore'
import type { PublicCollectionsStoreData } from './publicCollectionsStore'

export default class PublicCollectionsRoute extends React.Component<{}, PublicCollectionsStoreData> {
  private unlisteners: Function[] = []

  state = this.getFreshState()

  getFreshState() {
    return {
      isFetchingData: publicCollectionsStore.data.isFetchingData,
      assets: publicCollectionsStore.data.assets,
      metadata: publicCollectionsStore.data.metadata,
      totalSearchAssets: publicCollectionsStore.data.totalSearchAssets,
      orderColumnId: publicCollectionsStore.data.orderColumnId,
      orderValue: publicCollectionsStore.data.orderValue,
      filterColumnId: publicCollectionsStore.data.filterColumnId,
      filterValue: publicCollectionsStore.data.filterValue,
      currentPage: publicCollectionsStore.data.currentPage,
      totalPages: publicCollectionsStore.data.totalPages,
    }
  }

  componentDidMount() {
    this.unlisteners.push(publicCollectionsStore.listen(this.publicCollectionsStoreChanged.bind(this), this))
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {
      clb()
    })
  }

  publicCollectionsStoreChanged() {
    this.setState(this.getFreshState())
  }

  onAssetsTableOrderChange(columnId: string, value: OrderDirection) {
    publicCollectionsStore.setOrder(columnId, value)
  }

  onAssetsTableFilterChange(columnId: string | null, value: string | null) {
    publicCollectionsStore.setFilter(columnId, value)
  }

  onAssetsTableSwitchPage(pageNumber: number) {
    publicCollectionsStore.setCurrentPage(pageNumber)
  }

  render() {
    return (
      <DocumentTitle title={`${t('Public Collections')} | KoboToolbox`}>
        <div className='public-collections-wrapper'>
          <bem.Breadcrumbs m='gray-wrapper'>
            <bem.Breadcrumbs__crumb>{ROOT_BREADCRUMBS.PUBLIC_COLLECTIONS.label}</bem.Breadcrumbs__crumb>
          </bem.Breadcrumbs>

          <AssetsTable
            context={AssetsTableContextName.PUBLIC_COLLECTIONS}
            isLoading={this.state.isFetchingData}
            assets={this.state.assets}
            totalAssets={this.state.totalSearchAssets}
            metadata={this.state.metadata}
            orderColumnId={this.state.orderColumnId}
            orderValue={this.state.orderValue || null}
            onOrderChange={this.onAssetsTableOrderChange.bind(this)}
            filterColumnId={this.state.filterColumnId}
            filterValue={this.state.filterValue}
            onFilterChange={this.onAssetsTableFilterChange.bind(this)}
            currentPage={this.state.currentPage}
            totalPages={typeof this.state.totalPages === 'number' ? this.state.totalPages : undefined}
            onSwitchPage={this.onAssetsTableSwitchPage.bind(this)}
          />
        </div>
      </DocumentTitle>
    )
  }
}
