// Note: please be cautious in trusting those types. They should be fine, but AI helped build them.
//
// Context: this types definition file was built with AI assistance to significantly cut the time on building them.
// It was reviewed by a dev, but one who doesn't have full understanding of Backbone, plus Form Builder code written in
// CoffeeScript is quite old and rarely maintained - increasing the risk of having errors in here.
import type * as Backbone from 'backbone'
import type { Row } from './model.row'
import type { Survey } from './model.survey'

// Factory Interfaces

interface ModelFactory {
  create_operator(type: string, symbol?: string, id?: number): Backbone.Model
  create_criterion_model(): Backbone.Model
}

interface ViewFactory {
  survey: Survey
  // All create_* functions return the created view
  create_operator_picker(questionType: any): any
  create_response_value_view(question: Row | null, questionType: any, operatorType: any): any
  create_question_picker(currentQuestion: Row): any
  create_criterion_view(questionPicker: any, operatorPicker: any, responseValueView: any): any
  create_criterion_builder_view(): any
  create_textarea(value: string, className: string): any
  create_button(html: string, className: string): any
  create_skip_logic_picker_view(context: any): any
}

// Data Structures

export interface OperatorType {
  id: number
  type: string
  label: string
  negated_label: string
  abbreviated_label: string
  abbreviated_negated_label: string
  parser_name: string[]
  symbol: Record<string, string>
  response_type?: string
}

export interface QuestionTypeConfig {
  operators: number[] // Array of OperatorType IDs
  equality_operator_type?: string
  response_type?: string
  name: string
}

// Classes

export class SkipLogicPresenter {
  model: Backbone.Model
  view: any
  current_question: Row
  survey: Survey
  view_factory: ViewFactory
  dispatcher: Backbone.Events
  destination?: JQuery

  constructor(model: Backbone.Model, view: any, current_question: Row, survey: Survey, view_factory: ViewFactory)

  change_question(question_name: string): void
  change_operator(operator_id: number): void
  change_response(response_text: string): void
  change_response_view(question_type: any, operator_type: any): void
  finish_changing(): void
  is_valid(): boolean
  render(destination: JQuery): void
  serialize(): any

  // Injected by CriterionBuilderHelper
  serialize_all?: () => string
}

export class SkipLogicBuilder {
  model_factory: ModelFactory
  view_factory: ViewFactory
  survey: Survey
  current_question: Row
  helper_factory: SkipLogicHelperFactory
  criterion?: any
  selectable?: Row[]

  constructor(
    model_factory: ModelFactory,
    view_factory: ViewFactory,
    survey: Survey,
    current_question: Row,
    helper_factory: SkipLogicHelperFactory,
  )

  /** Returns [Criteria[], OperatorString] or false if parsing failed */
  build_criterion_builder(serialized_criteria: string): [any[], string] | false

  _parse_skip_logic_criteria(criteria: string): any
  build_operator_logic(question_type: any): [Backbone.Model, any]
  build_operator_model(question_type: any, symbol: string): Backbone.Model
  _operator_type(): OperatorType
  build_criterion_logic(
    operator_model: Backbone.Model,
    operator_picker_view: any,
    response_value_view: any,
  ): SkipLogicPresenter
  build_criterion(): SkipLogicPresenter | false
  _get_question(): Row | undefined
  build_empty_criterion(): SkipLogicPresenter
  questions(): Row[]
}

// Helpers

export class SkipLogicCriterionBuilderHelper {
  presenters: SkipLogicPresenter[]
  builder: SkipLogicBuilder
  view_factory: ViewFactory
  context: SkipLogicHelperContext
  view: any
  dispatcher: Backbone.Events
  destination: JQuery
  $criterion_delimiter: JQuery
  $add_new_criterion_button: JQuery

  constructor(
    presenters: SkipLogicPresenter[],
    separator: string,
    builder: SkipLogicBuilder,
    view_factory: ViewFactory,
    context: SkipLogicHelperContext,
  )

  determine_criterion_delimiter_visibility(): void
  render(destination: JQuery): void
  serialize(): string
  add_empty(): void
  remove(id: string): void
  determine_add_new_criterion_visibility(): void
  all_presenters_are_valid(): boolean
  switch_editing_mode(): void
}

export class SkipLogicHandCodeHelper {
  criteria: string
  builder: SkipLogicBuilder
  view_factory: ViewFactory
  context: SkipLogicHelperContext
  $parent: JQuery
  textarea: any
  button: any

  constructor(criteria: string, builder: SkipLogicBuilder, view_factory: ViewFactory, context: SkipLogicHelperContext)
  render($destination: JQuery): void
  serialize(): string
}

export class SkipLogicModeSelectorHelper {
  context: SkipLogicHelperContext
  criterion_builder_button: any
  handcode_button: any

  constructor(view_factory: ViewFactory, context: SkipLogicHelperContext)
  render($destination: JQuery): void
  serialize(): string
  switch_editing_mode(): void
}

// Main context/facade/factory

export class SkipLogicHelperContext {
  model_factory: ModelFactory
  view_factory: ViewFactory
  helper_factory: SkipLogicHelperFactory
  state:
    | SkipLogicCriterionBuilderHelper
    | SkipLogicHandCodeHelper
    | SkipLogicModeSelectorHelper
    | { serialize: () => string }
  destination?: JQuery
  builder?: SkipLogicBuilder

  constructor(
    model_factory: ModelFactory,
    view_factory: ViewFactory,
    helper_factory: SkipLogicHelperFactory,
    serialized_criteria: string,
  )

  render(destination?: JQuery): void
  serialize(): string
  use_criterion_builder_helper(): void
  use_hand_code_helper(): void
  use_mode_selector_helper(): void
}

export class SkipLogicPresentationFacade {
  model_factory: ModelFactory
  helper_factory: SkipLogicHelperFactory
  view_factory: ViewFactory
  context?: SkipLogicHelperContext

  constructor(model_factory: ModelFactory, helper_factory: SkipLogicHelperFactory, view_factory: ViewFactory)
  initialize(): void
  serialize(): string
  render(target: JQuery): void
}

export class SkipLogicHelperFactory {
  model_factory: ModelFactory
  view_factory: ViewFactory
  survey: Survey
  current_question: Row
  serialized_criteria: string

  constructor(
    model_factory: ModelFactory,
    view_factory: ViewFactory,
    survey: Survey,
    current_question: Row,
    serialized_criteria: string,
  )

  create_presenter(criterion_model: Backbone.Model, criterion_view: any): SkipLogicPresenter
  create_builder(): SkipLogicBuilder
  create_context(): SkipLogicHelperContext
}

// The exported object

declare const skipLogicHelpers: {
  SkipLogicHelperFactory: typeof SkipLogicHelperFactory
  SkipLogicPresentationFacade: typeof SkipLogicPresentationFacade
  SkipLogicPresenter: typeof SkipLogicPresenter
  SkipLogicBuilder: typeof SkipLogicBuilder
  SkipLogicHelperContext: typeof SkipLogicHelperContext
  SkipLogicCriterionBuilderHelper: typeof SkipLogicCriterionBuilderHelper
  SkipLogicHandCodeHelper: typeof SkipLogicHandCodeHelper
  SkipLogicModeSelectorHelper: typeof SkipLogicModeSelectorHelper

  question_types: Record<string, QuestionTypeConfig>
  operator_types: OperatorType[]
}
export default skipLogicHelpers
