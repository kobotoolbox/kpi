import $ from 'jquery';
import React from 'react';
import PropTypes from 'prop-types';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import alertify from 'alertifyjs';
import ReactTable from 'react-table'

import bem from 'js/bem';
import stores from 'js/stores';
import mixins from 'js/mixins';
import ui from 'js/ui';
import actions from 'js/actions';

import {t, getLangAsObject, getLangString, notify} from 'utils';

export class TranslationTable extends React.Component {
  constructor(props){
    super(props);
    this.state = {
      content: props.asset.content,
      tableData: []
    }

    let translated = props.asset.content.translated,
        survey = props.asset.content.survey,
        choices = props.asset.content.choices;

    for (var i = 0, len = survey.length; i < len; i++) {
      let row = survey[i];
      for (var j = 0, len2 = translated.length; j < len2; j++) {
        var property = translated[j];
        if (row[property]) {
          var tableRow = {
            original: row[property][0],
            translation: row[property][props.langIndex],
            name: row.name || row.$autoname,
            property: property
          }

          this.state.tableData.push(tableRow);
        }
      }
    }

    autoBind(this);
  }

  updateAsset (content) {
    actions.resources.updateAsset(
      this.props.asset.uid,
      {content: JSON.stringify(content)}
    );
  }
  render () {
    return (
      <bem.FormModal m='translation-table'>
        <ReactTable
          data={this.state.tableData}
          columns={[
            {
              Header: t("Original"),
              accessor: "original",
            },
            {
              Header: t("Translation"),
              accessor: "translation",
            }
          ]}
          showPagination={false}
          pageSize={1000}
          minRows={5}
          filterable
        />

      </bem.FormModal>
    );
  }
};

reactMixin(TranslationTable.prototype, Reflux.ListenerMixin);

export default TranslationTable;
