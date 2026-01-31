// Note: please be cautious in trusting those types. They should be fine, but AI helped build them.
//
// Context: this types definition file was built with AI assistance to significantly cut the time on building them.
// It was reviewed by a dev, but one who doesn't have full understanding of Backbone, plus Form Builder code written in
// CoffeeScript is quite old and rarely maintained - increasing the risk of having errors in here.
import * as Backbone from 'backbone'
import type { Survey } from './model.survey'

/** Factory for creating skip logic components based on question types. */
export class SkipLogicFactory {
  survey: Survey
  constructor(survey: Survey)
  create_operator(type: string, symbol: string, id: number): Operator
  create_criterion_model(): SkipLogicCriterion
  create_response_model(type: string): ResponseModel
}

/** Represents a single condition in a skip logic rule. */
export class SkipLogicCriterion extends Backbone.Model {
  factory: SkipLogicFactory
  survey: Survey

  constructor(factory: SkipLogicFactory, survey: Survey)

  /** Generates the final XPath string for this criterion */
  serialize(): string
  _get_question(): any
  /** Updates the criterion when the targeted question changes */
  change_question(cid: string): void
  /** Updates the operator and ensures the response type is still valid */
  change_operator(operator: string | number): void
  /** Calculates the required response type (text, number, dropdown, etc) */
  get_correct_type(): string
  /** Ensures choice options have valid XML names for dropdown logic */
  set_option_names(options: any[]): void
  /** Updates the expected response value/model */
  change_response(value: any): void
}

/** Base class for logic operators (=, !=, <, >, selected, etc.) */
export class Operator extends Backbone.Model {
  serialize(question_name: string, response_value: any): string
  get_value(): string
  get_type(): any
  get_id(): number
}

export class EmptyOperator extends Operator {}
export class SkipLogicOperator extends Operator {
  constructor(symbol: string)
}
export class TextOperator extends SkipLogicOperator {}
export class DateOperator extends SkipLogicOperator {}
export class ExistenceSkipLogicOperator extends SkipLogicOperator {}
export class SelectMultipleSkipLogicOperator extends SkipLogicOperator {}

/** Models for the "Value" side of a logic equation. Handles validation and formatting. */
export class ResponseModel extends Backbone.Model {
  constructor(type: string)
  get_type(): string
  set_value(value: any): void
}

export class IntegerResponseModel extends ResponseModel {}
export class DecimalResponseModel extends ResponseModel {}
export class DateResponseModel extends ResponseModel {}

declare const rowDetailsSkipLogic: {
  SkipLogicFactory: typeof SkipLogicFactory
  SkipLogicCriterion: typeof SkipLogicCriterion
  Operator: typeof Operator
  EmptyOperator: typeof EmptyOperator
  SkipLogicOperator: typeof SkipLogicOperator
  TextOperator: typeof TextOperator
  DateOperator: typeof DateOperator
  ExistenceSkipLogicOperator: typeof ExistenceSkipLogicOperator
  SelectMultipleSkipLogicOperator: typeof SelectMultipleSkipLogicOperator
  ResponseModel: typeof ResponseModel
  IntegerResponseModel: typeof IntegerResponseModel
  DecimalResponseModel: typeof DecimalResponseModel
  DateResponseModel: typeof DateResponseModel
}
export default rowDetailsSkipLogic
