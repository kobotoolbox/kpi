import React from 'react';
import PropTypes from 'prop-types';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import _ from 'underscore';
import {dataInterface} from '../dataInterface';

import actions from '../actions';
import bem from '../bem';
import stores from '../stores';
import mixins from '../mixins';

import ReactTable from 'react-table'

import {
  assign,
  t,
  log,
  notify,
} from '../utils';

export class DataTable extends React.Component {
  constructor(props){
    super(props);
    this.state = {
    	loading: true,
    	tableData: [],
    	columns: []
    };
    autoBind(this);

  }
  componentDidMount() {

  	// TEMPORARY hook-up to KC API (NOT FOR PRODUCTION)
  	// Only works with --disable-web-security flag in browser
    dataInterface.getToken().done((t) => {
    	if (t && t.token) {
		    var kc_server = document.createElement('a');
		    kc_server.href = this.props.asset.deployment__identifier;
		    let kc_url = kc_server.origin;

    		if (this.props.asset.uid) {
    			let uid = this.props.asset.uid;
    			dataInterface.getKCForm(kc_url, t.token, uid).done((form) => {
    				if (form && form.length === 1) {
    					form = form[0];
		    			dataInterface.getKCFormData(kc_url, t.token, form.formid).done((data) => {

		    				this.setState({
		    					loading: false,
		    					tableData: data
		    				})

		    				this._prepColumns(data);

		    			}).fail((failData)=>{
		      			console.log(failData);
					    });
    				}
    			}).fail((failData)=>{
      			console.log(failData);
			    });
    		}
    	}
    }).fail((failData)=>{
      alert('failed token');
    });
  }

  _prepColumns(data) {
  	console.log(data)
		var uniqueKeys = Object.keys(data.reduce(function(result, obj) {
		  return Object.assign(result, obj);
		}, {}))

		var columns = [];
    uniqueKeys.forEach(function(key){
    	if (key.startsWith('_') || key.includes('/')) {
    		// exclude these
    	} else {
      	columns.push({
  	    	Header: key,
    	  	accessor: key
	      });
    	}
    });

		this.setState({
			columns: columns
		})

  }

  render () {
  	if (this.state.loading) {
	    return (
	      <bem.Loading>
	        <bem.Loading__inner>
	          <i />
	          {t('loading...')}
	        </bem.Loading__inner>
	      </bem.Loading>
	    );  		
  	}

  const data = [{
    name: 'Tanner Linsley',
    age: 26,
    friend: {
      name: 'Jason Maurer',
      age: 23,
    }
  }]

  const columns = [{
    Header: 'Name',
    accessor: 'name' // String-based value accessors!
  }, {
    Header: 'Age',
    accessor: 'age',
    Cell: props => <span className='number'>{props.value}</span> // Custom cell components!
  }, {
    id: 'friendName', // Required because our accessor is not a string
    Header: 'Friend Name',
    accessor: d => d.friend.name // Custom value accessors!
  }, {
    Header: props => <span>Friend Age</span>, // Custom header components!
    accessor: 'friend.age'
  }]

    return (
      <bem.FormView>

	  		<ReactTable
  	  		data={this.state.tableData}
    			columns={this.state.columns}
		  		/>

      </bem.FormView>
    );
  }
};

export default DataTable;
