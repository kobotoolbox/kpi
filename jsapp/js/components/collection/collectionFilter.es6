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
			searchable: true,
			// isOpen: this.props.isOpen !== null ? this.props.isOpen : false,
		};
	},
	getInitialState () {
		return {
			filter: {
				source: 'question',
				options: []
			},
			searchable: true,
			clearable: true
		};
	},
	switchFilter (value) {
		var newFilter = value;
		console.log('Filter changed to ' + newFilter);
		dataInterface.filterGalleryImages(this.props.uid, newFilter).done((response)=>{
			var options = this.getOptions(response);
			this.setState({
				filter: {
					source: newFilter,
					options: options
				}
			});
		});
	},
	getOptions (data) {
		console.log(data);
		var options = [];
		console.log(data.results.length);
		for (var i = 0; i < data.results.length; i++){
			var asset = data.results[i];
			if(asset.question !== undefined){
				console.log(asset.question.label);
				options.push({label: asset.question.label, value: asset.question.label});
			}else{
				options.push({value: 'record-'+i, label:'record-'+i});
			}
		}
		return options;
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
		return (
			<bem.AssetGallery__headingSearchFilter className="section">
				<Select ref="collectionSelect" options={this.state.filter.options} simpleValue clearable={this.state.clearable} name="selected-collection" disabled={this.state.disabled} value={this.state.collectionValue} onChange={this.updateCollectionValue} searchable={this.state.searchable} />
				<Select ref="filterSelect" className="icon-button-select" options={filters} simpleValue name="selected-filter" disabled={this.state.disabled} value={this.state.filter.source} onChange={this.switchFilter} searchable={false} />
			</bem.AssetGallery__headingSearchFilter>
		);
	}
});


module.exports = CollectionsField;
