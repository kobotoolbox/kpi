import type { _DataSupplementResponseOneOfAutomaticGoogleTranscriptionVersionsItem } from "#/api/models/_dataSupplementResponseOneOfAutomaticGoogleTranscriptionVersionsItem";
import type { _DataSupplementResponseOneOfManualTranscriptionVersionsItem } from "#/api/models/_dataSupplementResponseOneOfManualTranscriptionVersionsItem";

export function isSupplementVersionWithValue<T extends _DataSupplementResponseOneOfAutomaticGoogleTranscriptionVersionsItem
    | _DataSupplementResponseOneOfManualTranscriptionVersionsItem = _DataSupplementResponseOneOfAutomaticGoogleTranscriptionVersionsItem
    | _DataSupplementResponseOneOfManualTranscriptionVersionsItem>(
  supplementData: T
): supplementData is T & { _data: {value: string } } {
  return supplementData._data && 'value' in supplementData._data && typeof supplementData._data.value === 'string'
}
