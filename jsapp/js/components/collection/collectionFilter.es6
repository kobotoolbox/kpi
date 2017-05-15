import React from 'react';
import Select from 'react-select';
import bem from '../../bem';
import {dataInterface} from '../../dataInterface'
const COLLECTIONS = require('../../data/collections');

var CollectionsField = React.createClass({
	displayName: 'CollectionsField',
	propTypes: {
		label: React.PropTypes.string,
		searchable: React.PropTypes.bool,
	},
	getDefaultProps () {
		return {
			label: 'Group By:',
			searchable: false
		};
	},
	getInitialState () {
		return {
			filter: {
				source: 'Group By Question',
				options: [],
				filterText: ''
			},
			searchable: false,
			clearable: true
		};
	},
	switchFilter (value) {
		var newFilter = value;
		console.log('Filter changed to ' + newFilter);
		dataInterface.filterGalleryImages(this.props.uid, newFilter).done((response)=>{
			// var options = this.getOptions(response);
			this.setState({
				filter: {
					source: newFilter
				}
			});
		});
	},
	updateCollectionValue (newValue) {
		console.log('Changed to ' + newValue);
		this.setState({
			collectionValue: newValue
		});
	},
	focusCollectionSelect () {
		this.refs.collectionSelect.focus();
	},
	render () {
		var filters = [
			{value: 'Group by Question', label: 'Group by Question'},
			{value: 'Group by Record', label: 'Group by Record'}
		]
		return (
			<bem.AssetGallery__headingSearchFilter className="section">
				<div className="text-display"><span>{this.state.filter.source}</span></div>
				<Select ref="filterSelect" className="icon-button-select" options={filters} simpleValue name="selected-filter" disabled={this.state.disabled} value={this.state.filter.source} onChange={this.switchFilter} searchable={false} />
			</bem.AssetGallery__headingSearchFilter>
		);
	}
});


module.exports = CollectionsField;
