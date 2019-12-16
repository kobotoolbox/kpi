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
  ASSETS_TABLE_CONTEXTS,
  ASSETS_TABLE_COLUMNS
} from './assetsTable';

const defaultColumn = ASSETS_TABLE_COLUMNS.get('last-modified');

class MyLibraryRoute extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      isLoading: myLibraryStore.data.isFetchingData,
      assets: myLibraryStore.data.assets,
      orderBy: defaultColumn,
      isOrderAsc: defaultColumn.defaultIsOrderAsc,
      currentPage: myLibraryStore.data.currentPage,
      totalPages: myLibraryStore.data.totalPages
    };

    autoBind(this);
  }

  componentDidMount() {
    this.listenTo(myLibraryStore, this.myLibraryStoreChanged);
  }

  myLibraryStoreChanged() {
    // TODO only list assets without parent (so collections and orphan assets)
    this.setState({
      isLoading: myLibraryStore.data.isFetchingData,
      assets: myLibraryStore.data.assets,
      currentPage: myLibraryStore.data.currentPage,
      totalPages: myLibraryStore.data.totalPages
    });
  }

  onAssetsTableReorder(orderBy, isOrderAsc) {
    this.setState({
      orderBy,
      isOrderAsc
    });
    // TODO tell myLibraryStore that column header was clicked
  }

  onAssetsTableSwitchPage(pageNumber) {
    this.setState({
      currentPage: pageNumber
    });
    // TODO tell myLibraryStore that page was changed
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
            assets={this.state.assets}
            isLoading={this.state.isLoading}
            orderBy={this.state.orderBy}
            isOrderAsc={this.state.isOrderAsc}
            onReorder={this.onAssetsTableReorder.bind(this)}
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
