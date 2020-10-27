import _ from 'underscore';
import React from 'react';
import autoBind from 'react-autobind';
import { dataInterface } from '../../dataInterface';
import orderBy from 'lodash.orderby';
import {getAssetDisplayName} from 'js/assetUtils';
import {
  AssetsTable,
  ASSETS_TABLE_CONTEXTS,
  ASSETS_TABLE_COLUMNS,
  ORDER_DIRECTIONS
} from './assetsTable';

const DEFAULT_ORDER_COLUMN = ASSETS_TABLE_COLUMNS.get('date-modified');

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
      orderColumnId: DEFAULT_ORDER_COLUMN.id,
      orderValue: DEFAULT_ORDER_COLUMN.defaultValue,
      filterColumnId: null,
      filterValue: null,
      nextPageUrl: null,
      prevPageUrl: null,
      assets: this.props.asset,
      nextAssets: [],
      prevAssets: [],
      currentPageNumber: 0,
    };
    autoBind(this);
  }

  onAssetsTableOrderChange(orderColumnId, orderValue) {
    debugger
    this.setState({orderColumnId, orderValue});
  }

  onAssetsTableFilterChange(filterColumnId, filterValue) {
    this.setState({filterColumnId, filterValue});
  }

  pageSwitch(newPageNumber) {
    let urlToLoad = null;
    // Go to next page
    if (newPageNumber > this.state.currentPageNumber) {
      if (this.state.nextPageUrl) {
        urlToLoad = this.state.nextPageUrl;
      } else if (this.state.assets.children.next) {
        urlToLoad = this.state.assets.children.next;
      }
      if (urlToLoad !== null) {
        dataInterface.loadNextPageUrl(urlToLoad).done((data) => {
          this.setState({
            nextPageUrl: data.children.next,
            prevPageUrl: data.children.previous
          });
          const newAssets = this.state.nextAssets;
          Object.values(data.children.results).forEach((item) => {
            newAssets.push(item);
          });
          this.setState({
            nextAssets: newAssets,
            currentPageNumber: newPageNumber
          });
        });
      }
    }
    debugger
    // Go to previous page
    if (newPageNumber < this.state.currentPageNumber) {
      if (this.state.prevPageUrl) {
        urlToLoad = this.state.prevPageUrl;
      } else if (this.state.assets.children.previous) {
        urlToLoad = this.state.assets.children.previous;
      }
      if (urlToLoad !== null) {
        dataInterface.loadNextPageUrl(urlToLoad).done((data) => {
          debugger
          this.setState({
            prevPageUrl: data.children.previous,
            prevAssets: data.children.results
          });
          const newAssets = this.state.prevAssets;
          this.setState({
            nextAssets: newAssets,
            currentPageNumber: newPageNumber
          });
        });
      }
    }
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

  mainOrderFunction(asset) {
    const orderColumn = ASSETS_TABLE_COLUMNS.get(this.state.orderColumnId);
    return asset[orderColumn.orderBy];
  }

  /**
   * Returns asset children ordered by column and columnValue
   * @return {Array}
   */
  getFilteredOrderedChildren() {
    let filteredChildren = this.state.assets.children.results;
    filteredChildren = filteredChildren.concat(this.state.nextAssets);
    if (this.state.filterColumnId) {
      filteredChildren = filteredChildren.filter((child) => {
        if (this.state.filterColumnId === ASSETS_TABLE_COLUMNS.get('languages').id) {
          const childLangs = _.property(ASSETS_TABLE_COLUMNS.get('languages').filterByPath)(child);
          return childLangs.includes(this.state.filterValue);
        }
        if (this.state.filterColumnId === ASSETS_TABLE_COLUMNS.get('organization').id) {
          const childOrg = _.property(ASSETS_TABLE_COLUMNS.get('organization').filterByPath)(child);
          return childOrg && childOrg === this.state.filterValue;
        }
        if (this.state.filterColumnId === ASSETS_TABLE_COLUMNS.get('primary-sector').id) {
          const childSector = _.property(ASSETS_TABLE_COLUMNS.get('primary-sector').filterByPath)(child);
          return childSector && childSector.value === this.state.filterValue;
        }
        if (this.state.filterColumnId === ASSETS_TABLE_COLUMNS.get('country').id) {
          const childCountry = _.property(ASSETS_TABLE_COLUMNS.get('country').filterByPath)(child);
          return childCountry && childCountry.value === this.state.filterValue;
        }
      });
    }

    let orderFn = this.mainOrderFunction.bind(this);
    if (this.state.orderColumnId === ASSETS_TABLE_COLUMNS.get('name').id) {
      orderFn = this.nameOrderFunction.bind(this);
    }
    const orderDirection = this.state.orderValue === ORDER_DIRECTIONS.get('ascending') ? 'asc' : 'desc';

    return orderBy(
      filteredChildren,
      // first order property is the one user chooses
      // second order property is always asset name in ascending direction
      [orderFn, this.nameOrderFunction.bind(this)],
      [orderDirection, 'asc'],
    );
  }

  getMetadataFromAssets(assets) {
    const metadata = {};

    let langs = [];
    let orgs = [];
    let sectors = [];
    let countries = [];

    assets.forEach((asset) => {
      // _.union makes it have unique values
      langs = _.union(langs, _.property(ASSETS_TABLE_COLUMNS.get('languages').filterByPath)(asset));

      const foundOrg = _.property(ASSETS_TABLE_COLUMNS.get('organization').filterByPath)(asset);
      if (typeof foundOrg === 'string' && foundOrg.length !== 0 && !orgs.includes(foundOrg)) {
        orgs.push(foundOrg);
      }

      const foundSector = _.property(ASSETS_TABLE_COLUMNS.get('primary-sector').filterByPath)(asset);
      if (foundSector && !_.find(sectors, (item) => {return item[0] === foundSector.value;})) {
        sectors.push([foundSector.value, foundSector.label]);
      }

      const foundCountry = _.property(ASSETS_TABLE_COLUMNS.get('country').filterByPath)(asset);
      if (foundCountry && !_.find(countries, (item) => {return item[0] === foundCountry.value;})) {
        countries.push([foundCountry.value, foundCountry.label]);
      }
    });

    // remove null language
    const foundNullIndex = langs.indexOf(null);
    if (foundNullIndex !== -1) {
      langs.splice(foundNullIndex, 1);
    }

    // sort all metadata arrays by abcs
    metadata[ASSETS_TABLE_COLUMNS.get('languages').filterByMetadataName] = langs.sort();
    metadata[ASSETS_TABLE_COLUMNS.get('organization').filterByMetadataName] = orgs.sort();
    metadata[ASSETS_TABLE_COLUMNS.get('primary-sector').filterByMetadataName] = _.sortBy(sectors, 0);
    metadata[ASSETS_TABLE_COLUMNS.get('country').filterByMetadataName] = _.sortBy(countries, 0);

    return metadata;
  }

  render() {
    const assets = this.getFilteredOrderedChildren();
    const metadata = this.getMetadataFromAssets(this.props.asset.children.results);
    const totalPages = Math.ceil(this.state.assets.children.count/100);

    return (
      <AssetsTable
        context={ASSETS_TABLE_CONTEXTS.get('collection-content')}
        assets={assets}
        totalAssets={assets.length}
        metadata={metadata}
        orderColumnId={this.state.orderColumnId}
        orderValue={this.state.orderValue}
        onOrderChange={this.onAssetsTableOrderChange.bind(this)}
        filterColumnId={this.state.filterColumnId}
        filterValue={this.state.filterValue}
        onFilterChange={this.onAssetsTableFilterChange.bind(this)}
        currentPage={this.state.currentPageNumber}
        totalPages={totalPages}
        onSwitchPage={this.pageSwitch.bind(this)}
      />
    );
  }
}

export default CollectionAssetsTable;
