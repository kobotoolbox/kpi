import React from 'react';
import PropTypes from 'prop-types';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import DocumentTitle from 'react-document-title';
import {t} from 'js/utils';
import publicCollectionsStore from './publicCollectionsStore';
import {
  AssetsTable,
  ASSETS_TABLE_CONTEXTS
} from './assetsTable';

class PublicCollectionsRoute extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      isLoading: publicCollectionsStore.data.isFetchingData,
      assets: publicCollectionsStore.data.assets,
      totalAssets: publicCollectionsStore.data.totalSearchAssets,
      column: publicCollectionsStore.data.column,
      columnValue: publicCollectionsStore.data.columnValue,
      currentPage: publicCollectionsStore.data.currentPage,
      totalPages: publicCollectionsStore.data.totalPages
    };

    autoBind(this);
  }

  componentDidMount() {
    this.listenTo(publicCollectionsStore, this.publicCollectionsStoreChanged);
  }

  publicCollectionsStoreChanged() {
    console.debug('publicCollectionsStoreChanged', publicCollectionsStore.data);

    this.setState({
      isLoading: publicCollectionsStore.data.isFetchingData,
      assets: publicCollectionsStore.data.assets,
      totalAssets: publicCollectionsStore.data.totalSearchAssets,
      column: publicCollectionsStore.data.column,
      columnValue: publicCollectionsStore.data.columnValue,
      currentPage: publicCollectionsStore.data.currentPage,
      totalPages: publicCollectionsStore.data.totalPages
    });
  }

  onAssetsTableColumnChange(column, columnValue) {
    publicCollectionsStore.setOrder(column, columnValue);
  }

  onAssetsTableSwitchPage(pageNumber) {
    publicCollectionsStore.setCurrentPage(pageNumber);
  }

  render() {
    return (
      <DocumentTitle title={`${t('Public Collections')} | KoboToolbox`}>
        <div className='public-collections-wrapper'>
          <AssetsTable
            context={ASSETS_TABLE_CONTEXTS.get('public-collections')}
            assets={this.state.assets}
            totalAssets={this.state.totalAssets}
            isLoading={this.state.isLoading}
            column={this.state.column}
            columnValue={this.state.columnValue}
            onColumnChange={this.onAssetsTableColumnChange.bind(this)}
            currentPage={this.state.currentPage}
            totalPages={this.state.totalPages}
            onSwitchPage={this.onAssetsTableSwitchPage.bind(this)}
          />
        </div>
      </DocumentTitle>
    );
  }
}

PublicCollectionsRoute.contextTypes = {
  router: PropTypes.object
};

reactMixin(PublicCollectionsRoute.prototype, Reflux.ListenerMixin);

export default PublicCollectionsRoute;
