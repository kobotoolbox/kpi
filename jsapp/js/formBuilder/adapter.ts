import clonedeep from 'lodash.clonedeep'
import type { AssetContent } from '#/dataInterface'
import dkobo_xlform from '../../xlform/src/_xlform.init'
import type { Survey } from '../../xlform/src/model.survey'
import { surveyToValidJson, unnullifyTranslations } from '#/components/formBuilder/formBuilderUtils'

export interface FormBuilderAdapter {
  load(assetContent: AssetContent): void
  serialize(): string
}

export class XlformAdapter implements FormBuilderAdapter {
  private survey: Survey | null = null

  load(assetContent: AssetContent): void {
    this.survey = dkobo_xlform.model.Survey.loadDict(clonedeep(assetContent))
  }

  serialize(): string {
    if (!this.survey) {
      throw new Error('load() must be called before serialize()')
    }
    let json = surveyToValidJson(this.survey)
    if (this.survey._initialParams?.translations_0) {
      json = unnullifyTranslations(json, this.survey._initialParams)
    }
    return json
  }
}
