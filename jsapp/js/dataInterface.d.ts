interface SubmissionResponse {
  [questionName: string]: any;
  __version__: string;
  _attachments: any[];
  _geolocation: any[];
  _id: number;
  _notes: any[];
  _status: string;
  _submission_time: string;
  _submitted_by: string|null;
  _tags: string[];
  _uuid: string;
  _validation_status: object;
  _version_: string;
  _xform_id_string: string;
  deviceid?: string;
  end?: string;
  "formhub/uuid": string;
  "meta/instanceID": string;
  phonenumber?: string;
  simserial?: string;
  start?: string;
  subscriberid?: string;
  today?: string;
  username?: string;
}

interface FailResponse {
  responseJSON: {
    detail: string
  }
  responseText: string
  status: number
  statusText: string
}
