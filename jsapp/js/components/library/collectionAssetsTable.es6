import React from 'react';
import autoBind from 'react-autobind';
import orderBy from 'lodash.orderby';
import {getAssetDisplayName} from 'js/assetUtils';
import {
  AssetsTable,
  ASSETS_TABLE_CONTEXTS,
  ASSETS_TABLE_COLUMNS
} from './assetsTable';

const defaultColumn = ASSETS_TABLE_COLUMNS.get('last-modified');

/**
 * A wrapper component over AssetsTable for usage on collection landing page.
 * It doesn't have much setup, as we use non-paginated results here and order
 * rows on Frontend to avoid unnecessary calls.
 *
 * @prop {object} asset
 */
class CollectionAssetsTable extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      sortColumn: defaultColumn,
      isOrderAsc: defaultColumn.defaultIsOrderAsc
    };
    autoBind(this);
  }

  onAssetsTableReorder(sortColumn, isOrderAsc) {
    this.setState({
      sortColumn,
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
    return asset[this.state.sortColumn.backendProp];
  }

  /**
   * Returns asset children ordered by sortColumn and isOrderAsc properties
   * @return {Array}
   */
  getOrderedChildren() {
    let orderFn = this.defaultOrderFunction.bind(this);
    if (this.state.sortColumn.id === ASSETS_TABLE_COLUMNS.get('name').id) {
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
        totalAssets={orderedChildren.length}
        sortColumn={this.state.sortColumn}
        isOrderAsc={this.state.isOrderAsc}
        onReorder={this.onAssetsTableReorder.bind(this)}
      />
    );
  }
}

export default CollectionAssetsTable;
