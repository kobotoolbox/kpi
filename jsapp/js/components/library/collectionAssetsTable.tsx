import React from 'react';
import AssetsTable from 'js/components/assetsTable/assetsTable';
import {AssetsTableContextName} from 'js/components/assetsTable/assetsTableConstants';
import type {OrderDirection} from 'js/projects/projectViews/constants';
import singleCollectionStore from './singleCollectionStore';
import type {AssetResponse} from 'js/dataInterface';

interface CollectionAssetsTableProps {
  asset: AssetResponse;
}

/**
 * A wrapper component over AssetsTable for usage on collection landing page.
 * Operates identically to `myLibraryRoute` but utilizes `singleCollectionStore`
 * instead.
 */
export default class CollectionAssetsTable extends React.Component<
  CollectionAssetsTableProps
> {
  private unlisteners: Function[] = [];

  // Listen for changes in store and update state to match
  componentDidMount() {
    this.unlisteners.push(
      singleCollectionStore.listen(this.onSingleCollectionStoreChanged.bind(this), this)
    );
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {clb();});
  }

  /**
  * Don't want to store a duplicate of store data here just for the sake of
  * comparison, so we need to make the component re-render itself when the
  * store changes :shrug:.
  */
  onSingleCollectionStoreChanged() {
    this.forceUpdate();
  }

  onAssetsTableOrderChange(
    columnId: string,
    columnValue: OrderDirection
  ) {
    singleCollectionStore.setOrder(columnId, columnValue);
  }

  onAssetsTableFilterChange(columnId: string | null, columnValue: string | null) {
    singleCollectionStore.setFilter(columnId, columnValue);
  }

  onAssetsTableSwitchPage(pageNumber: number) {
    singleCollectionStore.setCurrentPage(pageNumber);
  }

  render() {
    return (
      <AssetsTable
        context={AssetsTableContextName.COLLECTION_CONTENT}
        isLoading={singleCollectionStore.data.isFetchingData}
        assets={singleCollectionStore.data.assets}
        totalAssets={singleCollectionStore.data.totalSearchAssets}
        metadata={singleCollectionStore.data.metadata}
        orderColumnId={singleCollectionStore.data.orderColumnId}
        orderValue={singleCollectionStore.data.orderValue}
        onOrderChange={this.onAssetsTableOrderChange.bind(this)}
        filterColumnId={singleCollectionStore.data.filterColumnId}
        filterValue={singleCollectionStore.data.filterValue}
        onFilterChange={this.onAssetsTableFilterChange.bind(this)}
        currentPage={singleCollectionStore.data.currentPage}
        totalPages={singleCollectionStore.data.totalPages}
        onSwitchPage={this.onAssetsTableSwitchPage.bind(this)}
      />
    );
  }
}
