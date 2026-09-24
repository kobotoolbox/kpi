import {AssetTypeName, FormStyleName, UpdateStatesValue} from "#/constants"
import {AssetResponse} from "#/dataInterface"
import {Survey} from "../../xlform/src/model.survey"

interface FormbuilderHeaderProps {
  name: string
  asset: AssetResponse | undefined
  desiredAssetType: AssetTypeName | undefined
  asset_updated: UpdateStatesValue
  surveyAppRendered: boolean
  surveyLoadError: string | undefined
  surveySaveFail: boolean
  isNewAsset: boolean | undefined
  settings__style: FormStyleName | undefined
  backRoute: string | undefined
  groupButtonIsActive: boolean
  asideLibrarySearchVisible: boolean
  asideLayoutSettingsVisible: boolean
  hasMetadataAndDetails: boolean
  surveyHasRows: boolean
  surveyHasSelectQuestion: boolean
  onNavigateToList: () => void
  onNavigateToAsset: () => void
  onSave: (evt: React.TouchEvent<HTMLButtonElement>) => void
  onPreview: (evt: React.TouchEvent<HTMLButtonElement>) => void
  onNameChange: (evt: React.ChangeEvent<HTMLInputElement>) => void
  onShowAll: (evt: React.TouchEvent<HTMLButtonElement>) => void
  onGroupQuestions: () => void
  onToggleAsideLibrarySearch: (evt: React.TouchEvent<HTMLButtonElement>) => void
  onToggleAsideLayoutSettings: (evt: React.TouchEvent<HTMLButtonElement>) => void
  onGetCascadeInsertIndex: () => number
  onInsertCascade: (survey: Survey, rowIndex: number | undefined) => void
}

export default function FormbuilderHeader(props: FormbuilderHeaderProps) {
	
}
