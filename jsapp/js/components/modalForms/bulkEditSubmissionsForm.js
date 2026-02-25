import React from 'react'

import { Text } from '@mantine/core'
import Fuse from 'fuse.js'
import clonedeep from 'lodash.clonedeep'
import autoBind from 'react-autobind'
import { actions } from '#/actions'
import { getFlatQuestionsList, getSurveyFlatPaths, renderQuestionTypeIcon } from '#/assetUtils'
import bem from '#/bem'
import SimpleTable from '#/components/common/SimpleTable'
import Button from '#/components/common/button'
import TextBox from '#/components/common/textBox'
import { FUSE_OPTIONS, QuestionTypeName } from '#/constants'
import envStore from '#/envStore'
import { recordKeys } from '#/utils'

// we need a text to display when we need to say "this question has no answer"
const EMPTY_VALUE_LABEL = t('n/d')
// we need an override value that would mean "no answer" and that would be
// different than "no override answer" (de facto `undefined`)
const EMPTY_VALUE = null
const MULTIPLE_VALUES_LABEL = t('Multiple responses')
const HELP_ARTICLE_URL = 'editing_deleting_data.html'

/** These types are not compatible with bulk editing. */
const EXCLUDED_TYPES = [
  QuestionTypeName.audio,
  QuestionTypeName['background-audio'],
  QuestionTypeName.video,
  QuestionTypeName.image,
  QuestionTypeName.file,
]

/**
 * The content of the BULK_EDIT_SUBMISSIONS modal
 *
 * @prop {function} onSetModalTitle - for changing the modal title by this component
 * @prop {function} onModalClose - causes the modal to close
 * @prop {object} asset
 * @prop {object[]} data - submissions data (all user responses)
 * @prop {number} totalSubmissions - number of all submissions
 * @prop {string|number[]} selectedSubmissions - list of ids of submissions selected for bulk editing
 */
class BulkEditSubmissionsForm extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      isPending: false,
      // overrides keys are question names and values are edited values
      overrides: {},
      // single question selected for bulk editing
      selectedQuestion: null, // or object
      // with a temp override value that is being used until the single question form is saved
      selectedQuestionOverride: null,
      // values for searching the list of questions
      filterByName: '',
      filterByValue: '',
    }
    this.unlisteners = []
    autoBind(this)
  }

  componentDidMount() {
    this.unlisteners.push(
      actions.submissions.bulkPatchValues.completed.listen(this.onBulkPatchValuesCompleted),
      actions.submissions.bulkPatchValues.failed.listen(this.onBulkPatchValuesFailed),
    )
    this.setModalTitleToList()
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {
      clb()
    })
  }

  onBulkPatchValuesCompleted() {
    this.setState({ isPending: false })
    this.props.onModalClose()
  }

  onBulkPatchValuesFailed() {
    this.setState({ isPending: false })
  }

  setModalTitleToList() {
    this.props.onSetModalTitle(
      t('Editing ##count## submission(s)').replace('##count##', this.props.selectedSubmissions.length),
    )
  }

  setModalTitleToSingleQuestion(questionName) {
    this.props.onSetModalTitle(
      t('Editing "##question##" for ##count## submissions')
        .replace('##question##', questionName)
        .replace('##count##', this.props.selectedSubmissions.length),
    )
  }

  onRowOverrideChange(questionName, value) {
    if (questionName === this.state.selectedQuestion.name) {
      if (value === undefined) {
        this.setState({ selectedQuestionOverride: EMPTY_VALUE })
      } else {
        this.setState({ selectedQuestionOverride: value })
      }
    }
  }

  onSubmit(evt) {
    evt.preventDefault()
    // BE endpoint requires question names with paths
    // and we will gladly give them what they want
    const overridesWithPaths = {}
    const flatPaths = getSurveyFlatPaths(this.props.asset.content.survey)
    recordKeys(this.state.overrides).forEach((questionName) => {
      overridesWithPaths[flatPaths[questionName]] = this.state.overrides[questionName]
    })

    this.setState({ isPending: true })
    actions.submissions.bulkPatchValues(this.props.asset.uid, this.props.selectedSubmissions, overridesWithPaths)
  }

  onReset() {
    this.setState({ overrides: {} })
  }

  onFilterByNameChange(newFilter) {
    this.setState({ filterByName: newFilter })
  }

  onFilterByValueChange(newFilter) {
    this.setState({ filterByValue: newFilter })
  }

  selectQuestion(question) {
    this.setState({
      selectedQuestion: question,
      selectedQuestionOverride: this.state.overrides[question.name],
    })
    this.setModalTitleToSingleQuestion(question.label)
  }

  goBackToList() {
    this.setState({
      selectedQuestion: null,
      selectedQuestionOverride: null,
    })
    this.setModalTitleToList()
  }

  saveOverride() {
    const newOverrides = clonedeep(this.state.overrides)
    if (
      this.state.selectedQuestionOverride === EMPTY_VALUE ||
      (typeof this.state.selectedQuestionOverride === 'string' && this.state.selectedQuestionOverride.length >= 1)
    ) {
      newOverrides[this.state.selectedQuestion.name] = this.state.selectedQuestionOverride
    } else {
      delete newOverrides[this.state.selectedQuestion.name]
    }
    this.setState({ overrides: newOverrides })
    this.goBackToList()
  }

  /**
   * @returns {object[]} a list of question objects with all responses included
   */
  getDisplayData() {
    let questions = getFlatQuestionsList(this.props.asset.content.survey)
    const flatPaths = getSurveyFlatPaths(this.props.asset.content.survey)

    questions = questions.filter((question) => {
      // let's hide rows that don't carry any submission data
      if (
        question.type === QuestionTypeName.calculate ||
        question.type === QuestionTypeName.note ||
        question.type === QuestionTypeName.hidden
      ) {
        return false
      }

      // build selected data for question
      question.selectedData = []
      const questionPath = flatPaths[question.name]
      this.props.data.forEach((submissionData) => {
        if (this.props.selectedSubmissions.includes(String(submissionData._id))) {
          question.selectedData.push({
            sid: submissionData._id,
            value: submissionData[questionPath],
          })
        }
      })
      return true
    })
    return questions
  }

  renderSupportUrlLink() {
    if (envStore.isReady && envStore.data.support_url) {
      return (
        <a href={envStore.data.support_url + HELP_ARTICLE_URL} target='_blank'>
          {t('help article')}
        </a>
      )
    } else {
      return null
    }
  }

  isEditDisabled(questionType) {
    return EXCLUDED_TYPES.includes(questionType)
  }

  /**
   * A wrapper function that handles all quirks for displaying the question data
   * to users
   *
   * @param {string} questionName
   * @param {object} rowData - all responses to given question
   */
  renderRowDataValues(questionName, rowData) {
    // if there is an override value, let's display it (for override "no answer"
    // we display a label)
    const overrideValue = this.state.overrides[questionName]
    if (typeof overrideValue !== 'undefined') {
      if (overrideValue === null) {
        return (
          <React.Fragment>
            <i className='blue-response-dot' /> {EMPTY_VALUE_LABEL}
          </React.Fragment>
        )
      } else {
        return (
          <React.Fragment>
            <i className='blue-response-dot' /> {overrideValue}
          </React.Fragment>
        )
      }
    }

    const uniqueValues = new Set()
    rowData.forEach((item) => {
      if (item.value) {
        uniqueValues.add(item.value)
      } else {
        uniqueValues.add(EMPTY_VALUE_LABEL)
      }
    })
    const uniqueValuesArray = Array.from(uniqueValues)
    if (uniqueValuesArray.length === 1) {
      // if all rows have same value, we display it
      return uniqueValuesArray[0]
    } else {
      return <em>{MULTIPLE_VALUES_LABEL}</em>
    }
  }

  getFiltersRow() {
    return [
      '',
      <TextBox
        key='filter-by-name'
        value={this.state.filterByName}
        onChange={this.onFilterByNameChange}
        placeholder={t('Type to filter')}
      />,
      <TextBox
        key='filter-by-value'
        value={this.state.filterByValue}
        onChange={this.onFilterByValueChange}
        placeholder={t('Type to filter')}
      />,
      '',
    ]
  }

  getRows(data) {
    return data.map((questionData) => {
      let question = questionData
      if (typeof questionData.refIndex !== 'undefined') {
        question = questionData.item
      }

      return [
        renderQuestionTypeIcon(question.type),
        <>
          {question.parents.length > 0 && <small>{question.parents.join(' / ') + ' /'}</small>}

          <div>
            {question.isRequired && <strong title={t('Required')}>*&nbsp;</strong>}
            {question.label}
          </div>
        </>,
        <>
          {question.hasRepeatParent && (
            <em>{t('Editing responses from repeat group questions is not possible yet.')}</em>
          )}
          {!question.hasRepeatParent && this.renderRowDataValues(question.name, question.selectedData)}
        </>,
        <Text key='action-button' ta='right'>
          <Button
            type='secondary'
            size='m'
            onClick={() => {
              if (!this.isEditDisabled(question.type)) {
                this.selectQuestion(question)
              }
            }}
            isDisabled={
              this.isEditDisabled(question.type) ||
              // we don't support bulk editing questions from repeat groups yet
              // we display them but disabled
              question.hasRepeatParent
            }
            label={t('Edit')}
          />
        </Text>,
      ]
    })
  }

  renderList() {
    const displayData = this.getDisplayData()

    let finalData = displayData
    let fuse = null

    if (this.state.filterByName !== '') {
      fuse = new Fuse(finalData, { ...FUSE_OPTIONS, keys: ['label'] })
      finalData = fuse.search(this.state.filterByName)
    }
    if (this.state.filterByValue !== '') {
      fuse = new Fuse(finalData, { ...FUSE_OPTIONS, keys: ['selectedData.value'] })
      finalData = fuse.search(this.state.filterByValue)
    }

    return (
      <React.Fragment>
        <bem.FormModal__item m='wrapper'>
          {t('Bulk edit mode: Select questions to edit or delete responses across all selected submissions.')}
        </bem.FormModal__item>
        <bem.FormModal__item m='wrapper'>
          <strong>
            {t('Note: Changes made here bypass form logic and validation rules and may affect data integrity.')}
          </strong>{' '}
          {t('Learn more in our')} {this.renderSupportUrlLink()}.
        </bem.FormModal__item>

        <bem.FormModal__item m='wrapper'>
          <i className='blue-response-dot' />
          {t('Updated responses')}
        </bem.FormModal__item>

        <SimpleTable
          head={[
            t('Type'),
            t('Question'),
            t('Response'),
            <Text key='action-button' ta='right'>
              {t('Action')}
            </Text>,
          ]}
          body={[this.getFiltersRow(), ...this.getRows(finalData)]}
          minWidth={600}
        />

        <bem.Modal__footer>
          <Button
            type='danger'
            size='l'
            onClick={this.onReset.bind(this)}
            isDisabled={this.state.isPending || recordKeys(this.state.overrides).length === 0}
            label={t('Discard Changes')}
          />

          <Button
            type='primary'
            size='l'
            isSubmit
            onClick={this.onSubmit.bind(this)}
            isDisabled={this.state.isPending || recordKeys(this.state.overrides).length === 0}
            label={t('Confirm & close')}
          />
        </bem.Modal__footer>
      </React.Fragment>
    )
  }

  renderSelectedQuestion() {
    return (
      <React.Fragment>
        <bem.FormModal__item m='wrapper'>
          {t(
            'You are about to edit responses for one or multiple submissions at once. Use the XML syntax in the text box below. You can also select one of the existing responses from the table of responses. Learn more about how to edit specific responses for one or multiple submissions',
          )}{' '}
          {this.renderSupportUrlLink()}.
        </bem.FormModal__item>

        <bem.FormModal__item m='wrapper'>
          <BulkEditRowForm
            question={this.state.selectedQuestion}
            overrideData={this.state.selectedQuestionOverride}
            originalData={this.state.selectedQuestion.selectedData}
            onChange={this.onRowOverrideChange}
          />
        </bem.FormModal__item>

        <bem.Modal__footer>
          <Button
            type='secondary'
            size='l'
            onClick={this.goBackToList.bind(this)}
            label={t('Back')}
            className='footer-back-button'
          />

          <Button type='primary' size='l' onClick={this.saveOverride.bind(this)} label={t('Save')} />
        </bem.Modal__footer>
      </React.Fragment>
    )
  }

  render() {
    return (
      <bem.FormModal__form m='bulk-edit-submissions'>
        {this.state.selectedQuestion === null && this.renderList()}
        {this.state.selectedQuestion !== null && this.renderSelectedQuestion()}
      </bem.FormModal__form>
    )
  }
}

/**
 * This is a simple one input form for setting new value for multiple
 * submissions. Below input a table of existing answers (ordered by frequency)
 * allows for quick setting input value.
 *
 * @prop {object} question
 * @prop {object} overrideData
 * @prop {object} originalData
 * @prop {function} onChange - callback returning the new value
 */
class BulkEditRowForm extends React.Component {
  constructor(props) {
    super(props)
    autoBind(this)
  }

  onChange(newValue, evt) {
    if (evt) {
      evt.preventDefault()
    }
    this.props.onChange(this.props.question.name, newValue)
  }

  /**
   * Placeholder can be either a helpful instruction or an empty override value
   */
  getPlaceholderValue() {
    let placeholderValue = t('Type new response for selected submissions')
    if (this.props.overrideData === EMPTY_VALUE) {
      // user selected a "no answer" as a new override value for submissions
      // we don't want this EMPTY_VALUE_LABEL to be an editable value, so we
      // display it as a placeholder
      placeholderValue = EMPTY_VALUE_LABEL
    }
    return placeholderValue
  }

  /**
   * @returns {[][]} an ordered list of unique responses with frequency data.
   * Each data item (an array) has:
   * [0] {string|null} - the unique response value
   * [1] {number} - the total count for this unique response
   */
  getUniqueResponses() {
    let uniqueResponses = new Map()
    this.props.originalData.forEach((item) => {
      if (uniqueResponses.has(item.value)) {
        uniqueResponses.set(item.value, uniqueResponses.get(item.value) + 1)
      } else {
        uniqueResponses.set(item.value, 1)
      }
    })
    // sort by popularity
    uniqueResponses = new Map([...uniqueResponses.entries()].sort((a, b) => b[1] - a[1]))
    return uniqueResponses
  }

  getRows() {
    return Array.from(this.getUniqueResponses()).map((data) => {
      const count = data[1]
      const response = data[0]

      let responseLabel = response
      let responseValue = response
      if (response === undefined) {
        responseLabel = EMPTY_VALUE_LABEL
        responseValue = EMPTY_VALUE
      }

      const percentage = ((count / this.props.originalData.length) * 100).toFixed(2)

      return [
        responseLabel,
        count,
        percentage,
        <Text key='action-button' ta='right'>
          <Button type='secondary' size='m' onClick={this.onChange.bind(this, responseValue)} label={t('Select')} />
        </Text>,
      ]
    })
  }

  render() {
    let inputValue = ''
    if (typeof this.props.overrideData === 'string') {
      // there is already a non empty override value
      inputValue = this.props.overrideData
    }

    return (
      <React.Fragment>
        <bem.FormView__cell m={['columns', 'columns-top']} dir='auto'>
          <bem.FormView__cell m='column-icon'>{renderQuestionTypeIcon(this.props.question.type)}</bem.FormView__cell>

          <bem.FormView__cell m='column-1'>
            <h2>{this.props.question.label}</h2>

            <TextBox
              className='bulk-edit-response-textbox'
              type='text-multiline'
              value={inputValue}
              onChange={this.onChange}
              placeholder={this.getPlaceholderValue()}
            />
          </bem.FormView__cell>
        </bem.FormView__cell>

        <SimpleTable
          mt='lg'
          head={[
            t('Response value'),
            t('Frequency'),
            t('Percentage'),
            <Text key='action-button' ta='right'>
              {t('Action')}
            </Text>,
          ]}
          body={this.getRows()}
          minWidth={600}
        />
      </React.Fragment>
    )
  }
}

export default BulkEditSubmissionsForm
