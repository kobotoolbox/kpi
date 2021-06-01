import _ from 'underscore';
import React from 'react';
import autoBind from 'react-autobind';
import AssetsTable from './assetsTable';
import {ASSETS_TABLE_CONTEXTS} from './libraryConstants';
import singleCollectionStore from './singleCollectionStore';

/**
 * A wrapper component over AssetsTable for usage on collection landing page.
 *
 * Operates identically to `myLibraryRoute` but utilizes `singleCollectionStore`
 * instead.
 *
 * @prop {object} asset
 */
class CollectionAssetsTable extends React.Component {
  constructor(props) {
    super(props);
    this.state = this.getFreshState();
    this.unlisteners = [];
    autoBind(this);
  }

  getFreshState() {
    return {
      isLoading: singleCollectionStore.data.isFetchingData,
      assets: singleCollectionStore.data.assets,
      metadata: singleCollectionStore.data.metadata,
      totalAssets: singleCollectionStore.data.totalSearchAssets,
      orderColumnId: singleCollectionStore.data.orderColumnId,
      orderValue: singleCollectionStore.data.orderValue,
      filterColumnId: singleCollectionStore.data.filterColumnId,
      filterValue: singleCollectionStore.data.filterValue,
      currentPage: singleCollectionStore.data.currentPage,
      totalPages: singleCollectionStore.data.totalPages
    };
  }

  // Listen for changes in store and update state to match
  componentDidMount() {
    this.unlisteners.push(
      singleCollectionStore.listen(this.singleCollectionStoreChanged)
    );
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {clb();});
  }

  singleCollectionStoreChanged() {
    this.setState(this.getFreshState());
  }

  onAssetsTableOrderChange(orderColumnId, orderValue) {
    singleCollectionStore.setOrder(orderColumnId, orderValue);
  }

  onAssetsTableFilterChange(filterColumnId, filterValue) {
    singleCollectionStore.setFilter(filterColumnId, filterValue);
  }

  onAssetsTableSwitchPage(pageNumber) {
    singleCollectionStore.setCurrentPage(pageNumber);
  }

  render() {
    return (
      <AssetsTable
        context={ASSETS_TABLE_CONTEXTS.COLLECTION_CONTENT}
        isLoading={this.state.isLoading}
        assets={this.state.assets}
        totalAssets={this.state.totalAssets}
        metadata={this.state.metadata}
        orderColumnId={this.state.orderColumnId}
        orderValue={this.state.orderValue}
        onOrderChange={this.onAssetsTableOrderChange.bind(this)}
        filterColumnId={this.state.filterColumnId}
        filterValue={this.state.filterValue}
        onFilterChange={this.onAssetsTableFilterChange.bind(this)}
        currentPage={this.state.currentPage}
        totalPages={this.state.totalPages}
        onSwitchPage={this.onAssetsTableSwitchPage.bind(this)}
      />
    );
  }
}

export default CollectionAssetsTable;
