import React from 'react';
import ReactTable from 'react-table';
import TextareaAutosize from 'react-autosize-textarea';
import alertify from 'alertifyjs';
import bem from 'js/bem';
import actions from 'js/actions';
import stores from 'js/stores';
import {MODAL_TYPES} from 'js/constants';
import {t} from 'utils';

const SAVE_BUTTON_TEXT = {
  DEFAULT: t('Save Changes'),
  UNSAVED: t('* Save Changes'),
  PENDING: t('Saving…')
};

export class TranslationTable extends React.Component {
  constructor(props){
    super(props);
    this.state = {
      saveChangesButtonText: SAVE_BUTTON_TEXT.DEFAULT,
      isSaveChangesButtonPending: false,
      tableData: []
    };
    stores.translations.setTranslationTableUnsaved(false);
    const {translated, survey, choices, translations} = props.asset.content;
    const langIndex = props.langIndex;

    // add each translatable property for survey items to translation table
    survey.forEach((row) => {
      translated.forEach((property) => {
        if (row[property] && row[property][0]) {
          this.state.tableData.push({
            original: row[property][0],
            value: row[property][langIndex],
            name: row.name || row.$autoname,
            itemProp: property,
            contentProp: 'survey'
          });
        }
      });
    });

    // add choice options to translation table
    if (choices && choices.length) {
      choices.forEach((choice) => {
        if (choice.label && choice.label[0]) {
          this.state.tableData.push({
            original: choice.label[0],
            value: choice.label[langIndex],
            name: choice.name || choice.$autovalue,
            listName: choice.list_name,
            itemProp: 'label',
            contentProp: 'choices'
          });
        }
      });
    }

    this.columns = [
      {
        Header: t('Original string'),
        accessor: 'original',
        minWidth: 130,
        Cell: (cellInfo) => {return cellInfo.original.original;}
      }, {
        Header: t('##lang## translation').replace('##lang##', translations[langIndex]),
        accessor: 'translation',
        className: 'translation',
        Cell: (cellInfo) => {
          return (
            <TextareaAutosize
              onChange={(e) => {
                const data = [...this.state.tableData];
                data[cellInfo.index].value = e.target.value;
                this.setState({ data });
                this.markFormUnsaved();
              }}
              value={this.state.tableData[cellInfo.index].value || ''}
            />
          );
        }
      }
    ];
  }

  markFormUnsaved() {
    this.setState({
      saveChangesButtonText: SAVE_BUTTON_TEXT.UNSAVED,
      isSaveChangesButtonPending: false
    });
    stores.translations.setTranslationTableUnsaved(true);
  }

  markFormPending() {
    this.setState({
      saveChangesButtonText: SAVE_BUTTON_TEXT.PENDING,
      isSaveChangesButtonPending: true
    });
    stores.translations.setTranslationTableUnsaved(true);
  }

  markFormIdle() {
    this.setState({
      saveChangesButtonText: SAVE_BUTTON_TEXT.DEFAULT,
      isSaveChangesButtonPending: false
    });
    stores.translations.setTranslationTableUnsaved(false);
  }

  saveChanges() {
    let content = this.props.asset.content,
        rows = this.state.tableData,
        langIndex = this.props.langIndex;
    for (var i = 0, len = rows.length; i < len; i++) {
      let item = content[rows[i].contentProp].find((o) => {
        return (
          o.name === rows[i].name ||
          o.$autoname === rows[i].name ||
          o.$autovalue === rows[i].name
        ) && o.list_name === rows[i].listName;
      });
      let itemProp = rows[i].itemProp;

      if (item[itemProp][langIndex] !== rows[i].value) {
        item[itemProp][langIndex] = rows[i].value;
      }
    }

    this.markFormPending();
    actions.resources.updateAsset(
      this.props.asset.uid,
      {
        content: JSON.stringify(content)
      },
      {
        onComplete: this.markFormIdle.bind(this),
        onFailed: this.markFormUnsaved.bind(this)
      }
    );
  }

  onBack() {
    if (stores.translations.state.isTranslationTableUnsaved) {
      const dialog = alertify.dialog('confirm');
      const opts = {
        title: t('Go back?'),
        message: t('You will lose all unsaved changes.'),
        labels: {ok: t('Confirm'), cancel: t('Cancel')},
        onok: this.showManageLanguagesModal.bind(this),
        oncancel: dialog.destroy
      };
      dialog.set(opts).show();
    } else {
      this.showManageLanguagesModal();
    }
  }

  showManageLanguagesModal() {
    stores.pageState.switchModal({
      type: MODAL_TYPES.FORM_LANGUAGES,
      asset: this.props.asset
    });
  }

  render () {
    return (
      <bem.FormModal m='translation-table'>
        <div className='translation-table-container'>
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
        </div>

        <bem.Modal__footer>
          <bem.Modal__footerButton
            m='back'
            onClick={this.onBack.bind(this)}
          >
            {t('Back')}
          </bem.Modal__footerButton>

          <bem.Modal__footerButton
            m='primary'
            onClick={this.saveChanges.bind(this)}
            disabled={this.state.isSaveChangesButtonPending}
          >
            {this.state.saveChangesButtonText}
          </bem.Modal__footerButton>
        </bem.Modal__footer>
      </bem.FormModal>
    );
  }
}

export default TranslationTable;
