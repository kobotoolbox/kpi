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

    this.state = {
      isLoading: myLibraryStore.data.isFetchingData,
      assets: myLibraryStore.data.assets,
      metadata: myLibraryStore.data.metadata,
      totalAssets: myLibraryStore.data.totalSearchAssets,
      column: myLibraryStore.data.column,
      columnValue: myLibraryStore.data.columnValue,
      currentPage: myLibraryStore.data.currentPage,
      totalPages: myLibraryStore.data.totalPages
    };

    autoBind(this);
  }

  componentDidMount() {
    this.listenTo(myLibraryStore, this.myLibraryStoreChanged);
  }

  myLibraryStoreChanged() {
    this.setState({
      isLoading: myLibraryStore.data.isFetchingData,
      assets: myLibraryStore.data.assets,
      metadata: myLibraryStore.data.metadata,
      totalAssets: myLibraryStore.data.totalSearchAssets,
      column: myLibraryStore.data.column,
      columnValue: myLibraryStore.data.columnValue,
      currentPage: myLibraryStore.data.currentPage,
      totalPages: myLibraryStore.data.totalPages
    });
  }

  onAssetsTableColumnChange(column, columnValue) {
    myLibraryStore.setOrder(column, columnValue);
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
            column={this.state.column}
            columnValue={this.state.columnValue}
            columnValues={this.state.metadata}
            onColumnChange={this.onAssetsTableColumnChange.bind(this)}
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
