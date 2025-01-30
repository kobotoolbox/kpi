import _ from 'underscore'

import choices_templates from './view.choices.templates'
import accepted_files_templates from './view.acceptedFiles.templates'
import params_templates from './view.params.templates'
import row_templates from './view.row.templates'
import rowDetail_templates from './view.rowDetail.templates'
import rowSelector_templates from './view.rowSelector.templates'
import surveyApp_templates from './view.surveyApp.templates'

export default do ->
  templates =
    choices: choices_templates
    params: params_templates
    row: row_templates
    rowDetail: rowDetail_templates
    rowSelector: rowSelector_templates
    surveyApp: surveyApp_templates

  templates['AcceptedFilesView.input'] = accepted_files_templates.acceptedFilesInput
  templates['ParamsView.numberParam'] = params_templates.numberParam
  templates['ParamsView.booleanParam'] = params_templates.booleanParam
  templates['xlfListView.addOptionButton']  = choices_templates.addOptionButton
  templates['row.mandatorySettingSelector'] = row_templates.mandatorySettingSelector
  templates['row.rowErrorView']             = row_templates.rowErrorView
  templates['row.xlfRowView']               = row_templates.xlfRowView
  templates['row.scoreView']                = row_templates.scoreView
  templates['row.rankView']                 = row_templates.rankView
  templates['surveyApp']                    = surveyApp_templates.surveyApp
  templates['xlfRowSelector.line']          = rowSelector_templates.line
  templates['xlfRowSelector.cell']          = rowSelector_templates.cell
  templates['xlfRowSelector.namer']         = rowSelector_templates.namer
  templates['xlfDetailView']                = rowDetail_templates

  $$render = (id, params...)->
    # Having a render method allows us to display error messages
    # better than 'undefined is not a function'.
    template = templates[id]
    unless template
      throw new Error("Template not available: '#{id}'")
    unless 'function' is typeof template
      throw new Error("Template not a function: '#{id}'")
    template(params...)

  templates.$$render = $$render

  templates
