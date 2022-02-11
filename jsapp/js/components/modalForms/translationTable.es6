import React from 'react';
import ReactTable from 'react-table';
import TextareaAutosize from 'react-autosize-textarea';
import LanguageForm from 'js/components/modalForms/languageForm';
import alertify from 'alertifyjs';
import bem from 'js/bem';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import {actions} from 'js/actions';
import {stores} from 'js/stores';
import {getLangString} from 'utils';
import {LOCKING_RESTRICTIONS} from 'js/components/locking/lockingConstants';
import {
  MODAL_TYPES,
  QUESTION_TYPES,
  GROUP_TYPES_BEGIN,
} from 'js/constants';
import {
  hasRowRestriction,
  hasAssetRestriction,
} from 'js/components/locking/lockingUtils';

const SAVE_BUTTON_TEXT = {
  DEFAULT: t('Save Changes'),
  UNSAVED: t('* Save Changes'),
  PENDING: t('Saving…'),
};

export class TranslationTable extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      saveChangesButtonText: SAVE_BUTTON_TEXT.DEFAULT,
      isSaveChangesButtonPending: false,
      tableData: [],
      showLanguageForm: false,
      langString: props.langString,
    };
    stores.translations.setTranslationTableUnsaved(false);
    const {translated, survey, choices, translations} = props.asset.content;
    const langIndex = props.langIndex;
    const editableColTitle =
      langIndex == 0 ? t('updated text') : t('translation');
    const lockedChoiceLists = [];

    // add each translatable property for survey items to translation table
    survey.forEach((row) => {
      let isLabelLocked = false;
      if (row?.label) {
        isLabelLocked = this.isRowLabelLocked(row.type, row.name);
      }

      // choices don't know what questions use them so we keep track of the
      // choice lists here to know if a question that uses them has
      // `choice_label_edit` enabled
      if (this.isChoiceLabelLocked(row.name) && row.select_from_list_name) {
        lockedChoiceLists.push(row.select_from_list_name);
      }

      translated.forEach((property) => {
        if (row[property] && row[property][0]) {
          this.state.tableData.push({
            original: row[property][0],
            value: row[property][langIndex],
            name: row.name || row.$autoname,
            itemProp: property,
            contentProp: 'survey',
            isLabelLocked: isLabelLocked,
          });
        }
      });
    });

    // add choice options to translation table
    if (choices && choices.length) {
      choices.forEach((choice) => {
        let isLabelLocked = lockedChoiceLists.includes(choice.list_name);
        if (choice.label && choice.label[0]) {
          this.state.tableData.push({
            original: choice.label[0],
            value: choice.label[langIndex],
            name: choice.name || choice.$autovalue,
            listName: choice.list_name,
            itemProp: 'label',
            contentProp: 'choices',
            isLabelLocked: isLabelLocked,
          });
        }
      });
    }

    this.columns = [
      {
        Header: t('Original string'),
        accessor: 'original',
        minWidth: 130,
        Cell: (cellInfo) => {
          // Disabling has no effect on this cell, but we do it to gray out the
          // text to indicate that the label is locked
          // TODO: Figure out what to do for the case of adding a new language
          //       when there are locked labels. These labels should be unlocked
          //       for the newly added languages and their translations only.
          return (
            <div
              className={
                cellInfo.original.isLabelLocked ? 'rt-td--disabled' : ''
              }
            >
              {cellInfo.original.original}
            </div>
          );
        },
      },
      {
        Header: () => {
          return (
            <React.Fragment>
              <bem.FormView__iconButton
                onClick={this.toggleRenameLanguageForm.bind(this)}
                disabled={!this.canEditLanguages()}
                className='right-tooltip form-view__icon-button-edit'
              >
                {this.state.showLanguageForm && <i className='k-icon k-icon-close' />}
                {!this.state.showLanguageForm && <i className='k-icon k-icon-edit' />}
              </bem.FormView__iconButton>
              {`${translations[langIndex]} ${editableColTitle}`}
            </React.Fragment>
          );
        },
        accessor: 'translation',
        className: 'translation',
        Cell: (cellInfo) => {
          return (
            <TextareaAutosize
              onChange={(e) => {
                const data = [...this.state.tableData];
                data[cellInfo.index].value = e.target.value;
                this.setState({data});
                this.markFormUnsaved();
              }}
              value={this.state.tableData[cellInfo.index].value || ''}
              disabled={cellInfo.original.isLabelLocked}
            />
          );
        },
      },
    ];
  }

  markFormUnsaved() {
    this.setState({
      saveChangesButtonText: SAVE_BUTTON_TEXT.UNSAVED,
      isSaveChangesButtonPending: false,
    });
    stores.translations.setTranslationTableUnsaved(true);
  }

  markFormPending() {
    this.setState({
      saveChangesButtonText: SAVE_BUTTON_TEXT.PENDING,
      isSaveChangesButtonPending: true,
    });
    stores.translations.setTranslationTableUnsaved(true);
  }

  markFormIdle() {
    this.setState({
      saveChangesButtonText: SAVE_BUTTON_TEXT.DEFAULT,
      isSaveChangesButtonPending: false,
    });
    stores.translations.setTranslationTableUnsaved(false);
  }

  toggleRenameLanguageForm(evt) {
    evt.stopPropagation();
    this.setState({showLanguageForm: !this.state.showLanguageForm});
  }

  saveChanges() {
    let content = this.props.asset.content,
      rows = this.state.tableData,
      langIndex = this.props.langIndex;
    for (var i = 0, len = rows.length; i < len; i++) {
      let item = content[rows[i].contentProp].find((o) => {
        return (
          (o.name === rows[i].name ||
            o.$autoname === rows[i].name ||
            o.$autovalue === rows[i].name) &&
          o.list_name === rows[i].listName
        );
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
        content: JSON.stringify(content),
      },
      {
        onComplete: this.markFormIdle.bind(this),
        onFailed: this.markFormUnsaved.bind(this),
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
        oncancel: dialog.destroy,
      };
      dialog.set(opts).show();
    } else {
      this.showManageLanguagesModal();
    }
  }

  showManageLanguagesModal() {
    stores.pageState.switchModal({
      type: MODAL_TYPES.FORM_LANGUAGES,
      asset: this.props.asset,
    });
  }

  onLanguageChange(lang, index) {
    let content = this.props.asset.content,
      langString = getLangString(lang);

    content.translations[index] = langString;
    this.setState({langString: langString});

    if (index === 0) {
      content.settings.default_language = langString;
    }

    this.updateHeader(content);
  }

  updateHeader(content) {
    actions.resources.updateAsset(
      this.props.asset.uid,
      {content: JSON.stringify(content)},
      // reload asset on failure
      {
        onFailed: () => {
          actions.resources.loadAsset({id: this.props.asset.uid});
          alertify.error('failed to update translations');
        },
      }
    );
  }

  getAllLanguages() {
    return this.props.asset.content.translations;
  }

  // Compare current row type agaisnt those with lockable labels and return if
  // the relevant label restriction applies
  isRowLabelLocked(rowType, rowName) {
    if (rowType === GROUP_TYPES_BEGIN.begin_group) {
      return hasRowRestriction(
        this.props.asset.content,
        rowName,
        LOCKING_RESTRICTIONS.group_label_edit.name
      );
    } else {
      if (Object.keys(QUESTION_TYPES).includes(rowType)) {
        return hasRowRestriction(
          this.props.asset.content,
          rowName,
          LOCKING_RESTRICTIONS.question_label_edit.name
        );
      } else {
        return false;
      }
    }
  }

  isChoiceLabelLocked(rowName) {
    return hasRowRestriction(
      this.props.asset.content,
      rowName,
      LOCKING_RESTRICTIONS.choice_label_edit.name
    );
  }

  canEditLanguages() {
    return (
      this.props.asset?.content &&
      !hasAssetRestriction(
        this.props.asset.content,
        LOCKING_RESTRICTIONS.language_edit.name
      )
    );
  }

  render() {
    return (
      <bem.FormModal m='translation-table'>
        {this.state.showLanguageForm && (
          <bem.FormModal>
            <bem.FormModal__item>
              <bem.FormView__cell m='update-language-form'>
                <LanguageForm
                  langString={this.state.langString}
                  langIndex={this.props.langIndex}
                  onLanguageChange={this.onLanguageChange.bind(this)}
                  existingLanguages={this.getAllLanguages()}
                  isDefault={this.props.langIndex === 0}
                />
              </bem.FormView__cell>
            </bem.FormModal__item>
          </bem.FormModal>
        )}
        <div className='translation-table-container'>
          <ReactTable
            data={this.state.tableData}
            columns={this.columns}
            defaultPageSize={30}
            showPageSizeOptions={false}
            previousText={t('Prev')}
            nextText={t('Next')}
            minRows={1}
            loadingText={<LoadingSpinner />}
          />
        </div>

        <bem.Modal__footer>
          <bem.KoboButton m='whitegray' onClick={this.onBack.bind(this)}>
            {t('Back')}
          </bem.KoboButton>

          <bem.KoboButton
            m='blue'
            onClick={this.saveChanges.bind(this)}
            disabled={this.state.isSaveChangesButtonPending}
          >
            {this.state.saveChangesButtonText}
          </bem.KoboButton>
        </bem.Modal__footer>
      </bem.FormModal>
    );
  }
}

export default TranslationTable;
