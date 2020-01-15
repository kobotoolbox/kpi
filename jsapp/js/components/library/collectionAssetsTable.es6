import React from 'react';
import autoBind from 'react-autobind';
import orderBy from 'lodash.orderby';
import {getAssetDisplayName} from 'js/assetUtils';
import {
  AssetsTable,
  ASSETS_TABLE_CONTEXTS,
  ASSETS_TABLE_COLUMNS,
  ORDER_DIRECTIONS
} from './assetsTable';

const defaultColumn = ASSETS_TABLE_COLUMNS.get('date-modified');

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
      column: defaultColumn,
      columnValue: defaultColumn.defaultValue
    };
    autoBind(this);
  }

  onAssetsTableColumnChange(column, columnValue) {
    this.setState({column, columnValue});
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
    return asset[this.state.column.orderBy || this.state.column.filterBy];
  }

  /**
   * Returns asset children ordered by column and columnValue
   * @return {Array}
   */
  getOrderedChildren() {
    let orderFn = this.defaultOrderFunction.bind(this);
    if (this.state.column.id === ASSETS_TABLE_COLUMNS.get('name').id) {
      orderFn = this.nameOrderFunction.bind(this);
    }
    const orderDirection = this.state.columnValue === ORDER_DIRECTIONS.get('ascending') ? 'asc' : 'desc';

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
        column={this.state.column}
        columnValue={this.state.columnValue}
        onColumnChange={this.onAssetsTableColumnChange.bind(this)}
      />
    );
  }
}

export default CollectionAssetsTable;
