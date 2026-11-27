import type { DataSupplementResponse } from '#/api/models/dataSupplementResponse'
import type { SupplementalDataVersionItemAutomatic } from '#/api/models/supplementalDataVersionItemAutomatic'

export function buildAutomaticTranscriptVersion(
  dateCreated: string,
  status: 'in_progress' | 'complete' = 'in_progress',
): SupplementalDataVersionItemAutomatic {
  return {
    _uuid: dateCreated,
    _dateCreated: dateCreated,
    _data: status === 'complete' ? { language: 'en', status, value: 'Done' } : { language: 'en', status },
  } as SupplementalDataVersionItemAutomatic
}

/** A supplement whose Google transcription action holds `versions` and was last moved at `dateModified`. */
export function buildAutomaticTranscriptSupplement(
  xpath: string,
  dateModified: string,
  versions: SupplementalDataVersionItemAutomatic[],
  actionDateCreated = versions[0]._dateCreated,
): DataSupplementResponse {
  // `_version` clashes with the action record type, hence the assertion (see `common/utils.tests.ts`).
  return {
    _version: '1',
    [xpath]: {
      automatic_google_transcription: {
        _dateCreated: actionDateCreated,
        _dateModified: dateModified,
        _versions: versions,
      },
    },
  } as DataSupplementResponse
}
