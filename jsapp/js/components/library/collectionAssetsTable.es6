import React from 'react';
import PropTypes from 'prop-types';
import autoBind from 'react-autobind';
import reactMixin from 'react-mixin';
import Reflux from 'reflux';
import orderBy from 'lodash.orderby';
import mixins from 'js/mixins';
import {getAssetDisplayName} from 'js/assetUtils';
import {
  AssetsTable,
  ASSETS_TABLE_CONTEXTS,
  ASSETS_TABLE_COLUMNS
} from './assetsTable';

const defaultColumn = ASSETS_TABLE_COLUMNS.get('last-modified');

/**
 * A wrapper component over AssetsTable for usage on collection landing page
 */
class CollectionAssetsTable extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      orderBy: defaultColumn,
      isOrderAsc: defaultColumn.defaultIsOrderAsc,
      currentPage: 0,
      totalPages: null
    };
    autoBind(this);
  }

  onAssetsTableSwitchPage(pageNumber) {
    console.debug('onAssetsTableSwitchPage', pageNumber);
  }

  onAssetsTableReorder(orderBy, isOrderAsc) {
    this.setState({
      orderBy,
      isOrderAsc
    });
  }

  nameOrderFunction(asset) {
    const displayName = getAssetDisplayName(asset);
    if (displayName.empty) {
      // empty ones should be at the end
      return null;
    } else {
      return displayName.final.toLowerCase();
    }
  }

  defaultOrderFunction(asset) {
    return asset[this.state.orderBy.backendProp];
  }

  /**
   * Returns asset children ordered by orderBy and isOrderAsc properties
   * @return {Array}
   */
  getOrderedChildren() {
    let orderFn = this.defaultOrderFunction.bind(this);
    if (this.state.orderBy.id === ASSETS_TABLE_COLUMNS.get('name').id) {
      orderFn = this.nameOrderFunction.bind(this);
    }
    const orderDirection = this.state.isOrderAsc ? 'asc' : 'desc';

    return orderBy(
      this.props.asset.children.results,
      // first order property is the one user chooses
      // second order property is always asset name in ascending direction
      [orderFn, this.nameOrderFunction.bind(this)],
      [orderDirection, 'asc'],
    );
  }

  render() {
    const orderedChildren = this.getOrderedChildren();

    return (
      <AssetsTable
        context={ASSETS_TABLE_CONTEXTS.get('collection-content')}
        assets={orderedChildren}
        orderBy={this.state.orderBy}
        isOrderAsc={this.state.isOrderAsc}
        onReorder={this.onAssetsTableReorder.bind(this)}
      />
    );
  }
}

reactMixin(CollectionAssetsTable.prototype, mixins.contextRouter);
reactMixin(CollectionAssetsTable.prototype, Reflux.ListenerMixin);

CollectionAssetsTable.contextTypes = {
  router: PropTypes.object
};

export default CollectionAssetsTable;
