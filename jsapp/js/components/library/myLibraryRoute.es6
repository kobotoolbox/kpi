import React from 'react';
import PropTypes from 'prop-types';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import DocumentTitle from 'react-document-title';
import Dropzone from 'react-dropzone';
import mixins from 'js/mixins';
import {t, validFileTypes} from 'js/utils';
import myLibraryStore from './myLibraryStore';
import {
  AssetsTable,
  ASSETS_TABLE_CONTEXTS
} from './assetsTable';

class MyLibraryRoute extends React.Component {
  constructor(props) {
    super(props);
    this.state = this.getFreshState();
    this.unlisteners = [];
    autoBind(this);
  }

  getFreshState() {
    return {
      isLoading: myLibraryStore.data.isFetchingData,
      assets: myLibraryStore.data.assets,
      metadata: myLibraryStore.data.metadata,
      totalAssets: myLibraryStore.data.totalSearchAssets,
      orderColumnId: myLibraryStore.data.orderColumnId,
      orderValue: myLibraryStore.data.orderValue,
      filterColumnId: myLibraryStore.data.filterColumnId,
      filterValue: myLibraryStore.data.filterValue,
      currentPage: myLibraryStore.data.currentPage,
      totalPages: myLibraryStore.data.totalPages
    };
  }

  componentDidMount() {
    this.unlisteners.push(
      myLibraryStore.listen(this.myLibraryStoreChanged)
    );
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {clb();});
  }

  myLibraryStoreChanged() {
    this.setState(this.getFreshState());
  }

  onAssetsTableOrderChange(orderColumnId, orderValue) {
    myLibraryStore.setOrder(orderColumnId, orderValue);
  }

  onAssetsTableFilterChange(filterColumnId, filterValue) {
    myLibraryStore.setFilter(filterColumnId, filterValue);
  }

  onAssetsTableSwitchPage(pageNumber) {
    myLibraryStore.setCurrentPage(pageNumber);
  }

  render() {
    return (
      <DocumentTitle title={`${t('My Library')} | KoboToolbox`}>
        <Dropzone
          onDrop={this.dropFiles}
          disableClick
          multiple
          className='dropzone'
          activeClassName='dropzone--active'
          accept={validFileTypes()}
        >
          <AssetsTable
            context={ASSETS_TABLE_CONTEXTS.get('my-library')}
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
        </Dropzone>
      </DocumentTitle>
    );
  }
}

MyLibraryRoute.contextTypes = {
  router: PropTypes.object
};

reactMixin(MyLibraryRoute.prototype, mixins.droppable);
reactMixin(MyLibraryRoute.prototype, Reflux.ListenerMixin);

export default MyLibraryRoute;
