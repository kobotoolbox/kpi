import React from 'react'
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
        if (row[property]) {
          var tableRow = {
            original: row[property][0],
            translation: row[property][props.langIndex],
            name: row.name || row.$autoname,
            itemProp: property,
            contentProp: 'survey'
          }

          this.state.tableData.push(tableRow);
        }
      }
    }

    // add choice options to translation table
    for (var i = 0, len = choices.length; i < len; i++) {
      let choice = choices[i];
      var tableRow = {
        original: choice.label[0],
        translation: choice.label[props.langIndex],
        name: choice.name || choice.$autovalue,
        itemProp: 'label',
        contentProp: 'choices'
      }
      this.state.tableData.push(tableRow);
    }
  }
  onChange(value, index) {
    let tD = this.state.tableData;
    tD[index].translation = value;
    this.setState({
      tableData: tD
    });
  }
  saveChanges() {
    var content = this.props.asset.content;
    let rows = this.state.tableData,
        langIndex = this.props.langIndex;
    for (var i = 0, len = rows.length; i < len; i++) {
      let contentProp = rows[i].contentProp;
      let item = content[rows[i].contentProp].find(o => o.name === rows[i].name || o.$autoname === rows[i].name || o.$autovalue === rows[i].name);
      var itemProp = rows[i].itemProp;

      if (item[itemProp][langIndex] !== rows[i].translation) {
        item[itemProp][langIndex] = rows[i].translation;
      }
    }

    actions.resources.updateAsset(
      this.props.asset.uid,
      {content: JSON.stringify(content)}
    );
  }
  render () {
    let langIndex = this.props.langIndex,
        translationLabel = this.props.asset.content.translations[langIndex];
    return (
      <bem.FormModal m='translation-table'>
        <bem.FormModal__item m='translation-table--container'>
          <table>
            <thead>
              <tr>
                <th>{t('Original string')}</th>
                <th>{`${translationLabel} ${t('Translation')}`}</th>
              </tr>
            </thead>
            <tbody>
                {this.state.tableData.map((item, i)=>{
                  return (
                      <tr key={i}>
                        <td>{item.original}</td>
                        <td className={item.translation ? 'translation' : 'translation missing'}>
                          <TextareaAutosize
                            onChange={e => this.onChange(e.target.value, i)}
                            value={item.translation}/>
                        </td>
                      </tr>
                    );
                })}
            </tbody>
          </table>
        </bem.FormModal__item>
        <bem.FormModal__item m='translation-table--actions'>
          <button className="mdl-button mdl-button--raised mdl-button--colored" onClick={this.saveChanges.bind(this)}>
            {t('Save Changes')}
          </button>
        </bem.FormModal__item>
      </bem.FormModal>
    );
  }
};

export default TranslationTable;
