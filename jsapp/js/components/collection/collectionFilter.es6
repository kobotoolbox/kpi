import React from 'react';
import Select from 'react-select';
import bem from '../../bem';

const COLLECTIONS = require('../../data/collections');

var CollectionsField = React.createClass({
	displayName: 'CollectionsField',
	propTypes: {
		label: React.PropTypes.string,
		searchable: React.PropTypes.bool,
	},
	toggleFilterSelect(event){
		const fieldInput = this.refs.filterSelect;
		if (!fieldInput.state.isOpen) {
			fieldInput.handleMouseDown(event);
		}
		else{

		}
	},
	getDefaultProps () {
		return {
			label: 'States:',
			searchable: true,
			// isOpen: this.props.isOpen !== null ? this.props.isOpen : false,
		};
	},
	getInitialState () {
		return {
			filter: 'questions',
			searchable: true,
			clearable: true
		};
	},
	switchFilter (value) {
		var newFilter = value;
		console.log('Filter changed to ' + newFilter);
		this.setState({
			filter: newFilter
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
		var filters = COLLECTIONS.filters;
		var options = COLLECTIONS.options[this.state.filter];
		return (
			<bem.AssetGallery__headingSearchFilter className="section">
				<Select ref="collectionSelect" options={options} simpleValue clearable={this.state.clearable} name="selected-collection" disabled={this.state.disabled} value={this.state.collectionValue} onChange={this.updateCollectionValue} searchable={this.state.searchable} />
				<Select ref="filterSelect" options={filters} simpleValue name="selected-filter" disabled={this.state.disabled} value={this.state.filter} onChange={this.switchFilter} searchable={false} />
			</bem.AssetGallery__headingSearchFilter>
		);
	}
});


module.exports = CollectionsField;
