import React from 'react';
import PropTypes from 'prop-types';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import DocumentTitle from 'react-document-title';
import Dropzone from 'react-dropzone';
import mixins from 'js/mixins';
import bem from 'js/bem';
import {stores} from 'js/stores';
import {validFileTypes} from 'utils';
import {redirectToLogin} from 'js/router/routerUtils';
import myLibraryStore from './myLibraryStore';
import AssetsTable from './assetsTable';
import {MODAL_TYPES} from 'js/constants';
import {
  ROOT_BREADCRUMBS,
  ASSETS_TABLE_CONTEXTS,
} from 'js/components/library/libraryConstants';

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
      totalPages: myLibraryStore.data.totalPages,
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

  /**
   * If only one file was passed, then open a modal for selecting the type.
   * Otherwise just start uploading all files.
   */
  onFileDrop(files, rejectedFiles, evt) {
    if (files.length === 1) {
      stores.pageState.switchModal({
        type: MODAL_TYPES.LIBRARY_UPLOAD,
        file: files[0],
      });
    } else {
      this.dropFiles(files, rejectedFiles, evt);
    }
  }

  render() {
    if (!stores.session.isLoggedIn && stores.session.isAuthStateKnown) {
      redirectToLogin();
      return null;
    }

    let contextualEmptyMessage = t('Your search returned no results.');

    if (myLibraryStore.data.totalUserAssets === 0) {
      contextualEmptyMessage = (
        <div>
          {t("Let's get started by creating your first library question, block, template or collection. Click the New button to create it.")}
          <div className='pro-tip'>
            {t('Advanced users: You can also drag and drop XLSForms here and they will be uploaded and converted to library items.')}
          </div>
        </div>
      );
    }

    return (
      <DocumentTitle title={`${t('My Library')} | KoboToolbox`}>
        <Dropzone
          onDrop={this.onFileDrop}
          disableClick
          multiple
          className='dropzone'
          activeClassName='dropzone--active'
          accept={validFileTypes()}
        >
          <bem.Breadcrumbs m='gray-wrapper'>
            <bem.Breadcrumbs__crumb>{ROOT_BREADCRUMBS.MY_LIBRARY.label}</bem.Breadcrumbs__crumb>
          </bem.Breadcrumbs>

          <AssetsTable
            context={ASSETS_TABLE_CONTEXTS.MY_LIBRARY}
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
            emptyMessage={contextualEmptyMessage}
          />

          <div className='dropzone-active-overlay'>
            <i className='k-icon k-icon-upload'/>
            {t('Drop files to upload')}
          </div>
        </Dropzone>
      </DocumentTitle>
    );
  }
}

MyLibraryRoute.contextTypes = {
  router: PropTypes.object,
};

reactMixin(MyLibraryRoute.prototype, mixins.droppable);
reactMixin(MyLibraryRoute.prototype, Reflux.ListenerMixin);

export default MyLibraryRoute;
