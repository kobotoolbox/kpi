import React from 'react'
import ReactTable from 'react-table'
import TextareaAutosize from 'react-autosize-textarea'

import bem from 'js/bem'
import actions from 'js/actions'

import {t, getLangAsObject, getLangString, notify} from 'utils'

export class TranslationTable extends React.Component {
  constructor(props){
    super(props);
    this.state = {
      tableData: []
    }

    let translated = props.asset.content.translated,
        survey = props.asset.content.survey,
        choices = props.asset.content.choices;

    // add each translatable property for survey items to translation table
    for (var i = 0, len = survey.length; i < len; i++) {
      let row = survey[i];
      for (var j = 0, len2 = translated.length; j < len2; j++) {
        var property = translated[j];
        if (row[property] && row[property][0]) {
          var tableRow = {
            original: row[property][0],
            value: row[property][props.langIndex],
            name: row.name || row.$autoname,
            itemProp: property,
            contentProp: 'survey'
          }

          this.state.tableData.push(tableRow);
        }
      }
    }

    // add choice options to translation table
    if (choices && choices.length) {
      for (var i = 0, len = choices.length; i < len; i++) {
        let choice = choices[i];
        if (choice && choice.label[0]) {
          var tableRow = {
            original: choice.label[0],
            value: choice.label[props.langIndex],
            name: choice.name || choice.$autovalue,
            itemProp: 'label',
            contentProp: 'choices'
          }
          this.state.tableData.push(tableRow);
        }
      }
    }

    let translationLabel = props.asset.content.translations[props.langIndex];
    this.columns = [
      {
        Header: t('Original string'),
        accessor: 'original',
        minWidth: 130,
        Cell: row => row.original.original
      },{
        Header: `${translationLabel} ${t('Translation')}`,
        accessor: 'translation',
        className: 'translation',
        Cell: cellInfo => (
          <TextareaAutosize
            onChange={e => {
              const data = [...this.state.tableData];
              data[cellInfo.index].value = e.target.value;
              this.setState({ data });
            }}
            value={this.state.tableData[cellInfo.index].value || ''}/>
        )
      }
    ];
  }

  saveChanges() {
    var content = this.props.asset.content;
    let rows = this.state.tableData,
        langIndex = this.props.langIndex;
    for (var i = 0, len = rows.length; i < len; i++) {
      let contentProp = rows[i].contentProp;
      let item = content[rows[i].contentProp].find(o => o.name === rows[i].name || o.$autoname === rows[i].name || o.$autovalue === rows[i].name);
      var itemProp = rows[i].itemProp;

      if (item[itemProp][langIndex] !== rows[i].value) {
        item[itemProp][langIndex] = rows[i].value;
      }
    }

    actions.resources.updateAsset(
      this.props.asset.uid,
      {content: JSON.stringify(content)}
    );
  }

  render () {
    return (
      <bem.FormModal m='translation-table'>
        <bem.FormModal__item m='translation-table--container'>
        <ReactTable
          data={this.state.tableData}
          columns={this.columns}
          defaultPageSize={30}
          showPageSizeOptions={false}
          previousText={t('Prev')}
          nextText={t('Next')}
          minRows={1}
          loadingText={
            <span>
              <i className='fa k-spin fa-circle-o-notch' />
              {t('Loading...')}
            </span>
          }
        />
        </bem.FormModal__item>
        <bem.FormModal__item m='translation-table--actions'>
          <button className='mdl-button mdl-button--raised mdl-button--colored' onClick={this.saveChanges.bind(this)}>
            {t('Save Changes')}
          </button>
        </bem.FormModal__item>
      </bem.FormModal>
    );
  }
};

export default TranslationTable;
