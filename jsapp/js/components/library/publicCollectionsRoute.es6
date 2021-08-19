import React from 'react';
import PropTypes from 'prop-types';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import DocumentTitle from 'react-document-title';
import bem from 'js/bem';
import publicCollectionsStore from './publicCollectionsStore';
import AssetsTable from './assetsTable';
import {
  ROOT_BREADCRUMBS,
  ASSETS_TABLE_CONTEXTS,
} from 'js/components/library/libraryConstants';

class PublicCollectionsRoute extends React.Component {
  constructor(props) {
    super(props);
    this.state = this.getFreshState();
    this.unlisteners = [];
    autoBind(this);
  }

  getFreshState() {
    return {
      isLoading: publicCollectionsStore.data.isFetchingData,
      assets: publicCollectionsStore.data.assets,
      metadata: publicCollectionsStore.data.metadata,
      totalAssets: publicCollectionsStore.data.totalSearchAssets,
      orderColumnId: publicCollectionsStore.data.orderColumnId,
      orderValue: publicCollectionsStore.data.orderValue,
      filterColumnId: publicCollectionsStore.data.filterColumnId,
      filterValue: publicCollectionsStore.data.filterValue,
      currentPage: publicCollectionsStore.data.currentPage,
      totalPages: publicCollectionsStore.data.totalPages
    };
  }

  componentDidMount() {
    this.unlisteners.push(
      publicCollectionsStore.listen(this.publicCollectionsStoreChanged)
    );
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {clb();});
  }

  publicCollectionsStoreChanged() {
    this.setState(this.getFreshState());
  }

  onAssetsTableOrderChange(orderColumnId, orderValue) {
    publicCollectionsStore.setOrder(orderColumnId, orderValue);
  }

  onAssetsTableFilterChange(filterColumnId, filterValue) {
    publicCollectionsStore.setFilter(filterColumnId, filterValue);
  }

  onAssetsTableSwitchPage(pageNumber) {
    publicCollectionsStore.setCurrentPage(pageNumber);
  }

  render() {
    return (
      <DocumentTitle title={`${t('Public Collections')} | KoboToolbox`}>
        <div className='public-collections-wrapper'>
          <bem.Breadcrumbs m='gray-wrapper'>
            <bem.Breadcrumbs__crumb>{ROOT_BREADCRUMBS.PUBLIC_COLLECTIONS.label}</bem.Breadcrumbs__crumb>
          </bem.Breadcrumbs>

          <AssetsTable
            context={ASSETS_TABLE_CONTEXTS.PUBLIC_COLLECTIONS}
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
