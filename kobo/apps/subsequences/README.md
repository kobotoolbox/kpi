# Subsequence Actions – Supplement Processing Flow

This document explains the full flow when a client submits a **supplement** payload to the API.
It covers how the payload is validated through the various schemas (`params_schema`, `data_schema`, `external_data_schema`, `result_schema`), how external NLP services are invoked for automatic actions, and how versions are created and persisted.

---

## Table of Contents

2. [Subsequence User Flow]

## Subsequence User Flow

In general, the user flow for advanced features (aka subsequences) is as follows:
1. Enable the desired feature on the survey question
2. Modify the parameters of the feature as desired
3. Update the submission with new supplementary data
4. The submission table and exports view will reflect the new data

### Selected response

For any given question, for any submission, there is only
* One selected transcript
* One selected translation per language
* One selected response to each QA question

How these selections are determined varies by feature.
* For transcripts and translations, the selected version is the most recently *accepted*, manual or automatic
  ** Notable exception: if there is a version marked "deleted", either manual or automatic, with a *creation* date after the most recently accepted version, the value will be empty
* For QA questions, the selected version is the most recently *created* response

### Examples

#### Automatic transcription

1. Enable automatic transcription in English - adds an (empty) column to the submission table
`POST /api/v2/assets/{uid_asset}/advanced-features/`

<details><summary>Request</summary>

```json
{
  "question_xpath": "audio_question",
  "action": "automatic_google_transcription",
  "params": [{"language": "en"}]
}
```
</details>

<details><summary>Response</summary>

```json
{
  "question_xpath":"audio_question",
  "action":"automatic_google_transcription",
  "params":[{"language":"en"}],
  "uid":"qaftnQRw6ZBNbNc9n7MSWzvx"
}
```
</details>

2. Request an automatic transcription in Spanish
`PATCH /api/v2/assets/{uid_asset}/data/{submission_root_uuid}/supplement/`

<details><summary>Request</summary>

```json
{
  "_version": "20250820",
  "audio_question": {
    "automatic_google_transcription": {
      "language": "es"
    }
  }
}
```
</details>

<details><summary>Response</summary>
`400 - Invalid payload`
</details>

3. Enable automatic transcription in Spanish - adds an (empty) column to the submission table
`PATCH /api/v2/assets/{uid_asset}/advanced-features/{uid_feature}/`

<details><summary>Request</summary>

```json
{
  "params": [{"language": "es"}]
}
```
</details>

<details><summary>Response</summary>

```json
{
  "params":[{"language":"en"},{"language":"es"}],
  "question_xpath":"audio_question",
  "action":"automatic_google_transcription",
  "asset":27,
  "uid":"qaftnQRw6ZBNbNc9n7MSWzvx"
}
```
</details>


4. Request automatic transcription in Spanish
`PATCH /api/v2/assets/{uid_asset}/data/{submission_root_uuid}/supplement/`

<details><summary>Request</summary>

```json
{
  "_version": "20250820",
  "audio_question": {
    "automatic_google_transcription": {
      "language": "es"
    }
  }
}
```
</details>

<details><summary>Response</summary>

```json
{
  "audio_question": {
    "automatic_google_transcription": {
      "_dateCreated":"2026-01-28T15:07:53.666960Z",
      "_dateModified":"2026-01-28T15:07:53.666960Z",
      "_versions": [
        {
          "_data": {
            "language":"es","status":"in_progress"
          },
          "_dateCreated":"2026-01-28T15:07:53.666960Z",
          "_uuid":"8df4a7f5-a05e-49a8-8620-d53dc0377535"
        }
      ]
    }
  },
  "_version":"20250820"
}
```
</details>

5. Poll to see if the transcription is done yet
`GET /api/v2/assets/{uid_asset}/data/{submission_root_uuid}/supplement/`
Response:

<details><summary>Response</summary>

```json
{
   "audio_question":{
      "automatic_google_transcription":{
         "_versions":[
            {
               "_data":{
                  "value":"Hola mundo",
                  "status":"complete",
                  "language":"es"
               },
               "_uuid":"9adfb1cf-0b21-4cb6-9ade-6a6bdd9cc830",
               "_dateCreated":"2026-01-28T15:21:17.091030Z"
            },
           {
             "_data": {
               "status": "in_progress",
               "language": "es"
             },
             "_uuid": "148381b2-ea51-4085-9968-acbb8608e749",
             "_dateCreated": "2026-01-28T15:21:06.416445Z"
           }
         ],
        "_version":"20250820"
      }
   }
}
```
</details>

6. Accept the transcript - Spanish transcript is now filled in the submission row
`PATCH /api/v2/assets/{uid_asset}/data/{submission_root_uuid}/supplement/`

<details><summary>Request</summary>

```json
{
  "_version": "20250820",
  "audio_question": {
    "automatic_google_transcription": {
      "language": "es",
      "accepted": true
    }
  }
}
```
</details><summary>Response</summary>

<details>

```json
{
   "audio_question":{
      "automatic_google_transcription":{
         "_versions":[
            {
               "_data":{
                  "value":"Hola mundo",
                  "status":"complete",
                  "language":"es"
               },
               "_uuid":"9adfb1cf-0b21-4cb6-9ade-6a6bdd9cc830",
               "_dateCreated":"2026-01-28T15:21:17.091030Z",
               "_dateAccepted":"2026-01028T15:30:34.034124Z"
            },
           {
             "_data": {
               "status": "in_progress",
               "language": "es"
             },
             "_uuid": "148381b2-ea51-4085-9968-acbb8608e749",
             "_dateCreated": "2026-01-28T15:21:06.416445Z"
           }
         ],
        "_version":"20250820"
      }
   }
}
```
</details>

7. Delete the transcript - removes the Spanish transcript from the submission row
`PATCH /api/v2/assets/{uid_asset}/data/{submission_root_uuid}/supplement/`

<details><summary>Request</summary>

```json
{
  "_version": "20250820",
  "audio_question": {
    "automatic_google_transcription": {
      "language": "es",
      "value": null
    }
  }
}
```
</details>

<details><summary>Response</summary>

```json
{
   "audio_question":{
      "automatic_google_transcription":{
         "_versions":[
           {
             "_data": {
               "language": "es",
               "value": null,
               "status": "deleted"
             },
             "_uuid":"4c227cd5-0d8b-4143-b60e-52a85e83dea6",
             "_dateCreated":"2026-01-28T15:59:42.921507Z"
           },
           {
               "_data":{
                  "value":"Hola mundo",
                  "status":"complete",
                  "language":"es"
               },
               "_uuid":"9adfb1cf-0b21-4cb6-9ade-6a6bdd9cc830",
               "_dateCreated":"2026-01-28T15:21:17.091030Z",
               "_dateAccepted":"2026-01028T15:30:34.034124Z"
           },
           {
             "_data": {
               "status": "in_progress",
               "language": "es"
             },
             "_uuid": "148381b2-ea51-4085-9968-acbb8608e749",
             "_dateCreated": "2026-01-28T15:21:06.416445Z"
           }
         ],
        "_version":"20250820"
      }
   }
}
```
</details>

#### Manual transcription/translation

1. Enable manual transcription in English - adds an (empty) column to the submission table
`POST /api/v2/assets/{uid_asset}/advanced-features/`

<details><summary>Request</summary>

```json
{
  "question_xpath": "audio_question",
  "action": "manual_transcription",
  "params": [{"language": "en"}]
}
```
</details>

<details><summary>Response</summary>

```json
{
  "question_xpath":"audio_question",
  "action":"manual_transcription",
  "params":[{"language":"en"}],
  "uid":"qaftnQRw6ZBNbNc9n7MSWzvx"
}
```
</details>


2. Enable manual translation in Spanish - adds an (empty) column to the submission table
`POST /api/v2/assets/{uid_asset}/advanced-features/`

<details><summary>Request</summary>

```json
{
  "question_xpath": "audio_question",
  "action": "manual_translation",
  "params": [{"language": "es"}]
}
```
</details>

<details><summary>Response</summary>

```json
{
  "params":[{"language":"es"}],
  "question_xpath":"audio_question",
  "action":"manual_translation",
  "asset":27,
  "uid":"qafAfeIAse99SnGxi0ini"
}
```
</details>

3. Request manual translation in Spanish
`PATCH /api/v2/assets/{uid_asset}/data/{submission_root_uuid}/supplement/`

<details><summary>Requestion</summary>

```json
{
  "_version": "20250820",
  "audio_question": {
    "manual_translation": {
      "language": "es",
      "value": "Hola mundo!"
    }
  }
}
```
</details>

<details><summary>Response</summary>
`400 - Cannot translate without transcription`
</details>

4. Add transcript in English - English transcript is now shown in the submission row
`PATCH /api/v2/assets/{uid_asset}/data/{submission_root_uuid}/supplement/`

<details><summary>Request</summary>

```json
{
  "_version": "20250820",
  "audio_question": {
    "manual_transcription": {
      "language": "en",
      "value": "Hello world!"
    }
  }
}
```
</details>

<details><summary>Response</summary>

```json
{
  "audio_question": {
    "manual_transcription": {
       "_versions":[
          {
             "_data":{
                "value":"Hello world!",
                "language":"en"
             },
             "_uuid":"9cc2ac6d-4835-4935-b776-1f268c1b8e8d",
             "_dateCreated":"2026-01-28T16:08:16.297609Z",
             "_dateAccepted":"2026-01-28T16:08:16.297609Z"
          }
       ],
       "_dateCreated":"2026-01-28T16:08:16.297609Z",
       "_dateModified":"2026-01-28T16:08:16.297609Z"
    }
  },
  "_version":"20250820"
}
```
</details>

5. Add a translation in Spanish - Spanish translation now shown in the submission row
`PATCH /api/v2/assets/{uid_asset}/data/{submission_root_uuid}/supplement/`

<details><summary>Request</summary>

```json
{
  "_version": "20250820",
  "audio_question": {
    "manual_translation": {
      "language": "es",
      "value": "Hola mundo!"
    }
  }
}
```
</details>

<details><summary>Response</summary>

```json
{
   "q1":{
      "manual_transcription":{
        "_dateCreated":"2026-01-28T16:08:16.297609Z",
         "_dateModified":"2026-01-28T16:08:16.297609Z",
         "_versions":[
            {
               "_data":{
                  "value":"Hello world!",
                  "language":"en"
               },
               "_uuid":"9cc2ac6d-4835-4935-b776-1f268c1b8e8d",
               "_dateCreated":"2026-01-28T16:08:16.297609Z",
               "_dateAccepted":"2026-01-28T16:08:16.297609Z"
            }
         ]
      },
      "manual_translation":{
         "es":{
            "_dateCreated":"2026-01-28T16:09:12.468809Z",
            "_dateModified":"2026-01-28T16:09:12.468809Z",
            "_versions":[
               {
                  "_data":{
                     "language":"es",
                     "value":"Hola mundo!"
                  },
                  "_dateCreated":"2026-01-28T16:09:12.468809Z",
                  "_uuid":"63f4cfba-3fd9-41ca-bc3b-d3efe7822545",
                  "_dependency":{
                     "_actionId":"manual_transcription",
                     "_uuid":"9cc2ac6d-4835-4935-b776-1f268c1b8e8d"
                  },
                  "_dateAccepted":"2026-01-28T16:09:12.468809Z"
               }
            ]
         }
      }
   },
   "_version":"20250820"
}
```
</details>


---

#### Qualitative analysis questions

1. Enable manual QA on the question - adds an (empty) column to the submission table
`POST /api/v2/assets/{uid_asset}/advanced-features/`

<details><summary>Request</summary>

```json
{
  "question_xpath": "audio_question",
  "action": "manual_transcription",
  "params": [
    {"language": "en"}
  ]
}
```
</details>


## 3 Sequence Workflow - Backend (End-to-End Flow)

This section explains how the system handles a supplement from the initial
client request, through validation and optional background retries.

### 3.1 Sequence Diagram – End-to-End

> The diagram shows the synchronous request until the first response.

```mermaid
sequenceDiagram
autonumber
actor Client
participant API as KPI API
participant SS as SubmissionSupplement
participant Action as Action (Manual/Automatic)
participant Ext as NLP Service (if automatic)
participant Celery as Celery Worker
participant DB as Database

Client->>API: POST /assets/<asset_uid>/data/<submission_root_uuid>/supplement
Note right of API: Parse payload & route

API->>SS: SubmissionSupplement.revise_data(payload)

loop For each action in _actionConfigs
  SS->>Action: action.revise_data(one_action_payload)
  Note right of Action: Validate with data_schema

  alt Action is automatic (BaseAutomaticNLPAction)
    Action->>Action: run_external_process()
    Action->>Ext: Call external NLP service
    Ext-->>Action: Response (augmented payload)
    alt status == "in_progress"
      Action->>Celery: enqueue poll_external_process task
    end
    Action->>Action: Validate with external_data_schema
  end

  Action->>Action: Build new version
  Action->>Action: Validate with result_schema
  Action->>DB: Save version JSON
end

SS-->>API: Aggregated result / status
API-->>Client: 200 OK (or error)
```

---

### 3.2 Background Polling with Celery

If run_external_process receives a response like:

```json
{"status": "in_progress"}
```


a Celery task (e.g. poll_external_process) is queued.
This task will periodically re-invoke the external service until the action’s
status becomes complete or a maximum retry limit is reached.
The task uses the same validation chain (external_data_schema → result_schema)
before persisting the final revision.

---

### 3.3 Flowchart (Logic inside `revise_data` per Action)

> This diagram shows the decision tree when validating and processing a single action payload.

```mermaid
flowchart TB
  A[Incoming action payload]
  B[Attach action dependency]
  C{Is automatic action?}
  D[Add dependency supplemental data if any]
  E[Build version]
  F[Validate with result schema]
  G[Save to DB]
  H[Done]
  I[Run external process]
  J[Sanitize dependency supplemental data]
  K[Validate with external data schema]
  L[Enqueue Celery task poll_external_process]
  M[Return 4xx error]
  N{Status in_progress?}

  A --> B
  B --> C
  C -->|no| D
  D --> E
  E --> F
  F --> G
  G --> H

  C -->|yes| I
  I --> N
  N -->|yes| L
  N -->|no| J
  J --> K
  K -->|fail| M
  K -->|ok| E

  B -->|invalid dependency| M
```

---

## 4. Where Schemas Apply

Every action relies on a set of schemas to validate its lifecycle:
- **`params_schema`** – defines how the action is instantiated and configured on the Asset.
- **`data_schema`** – validates the client payload sent in supplements.
- **`external_data_schema`** – extends `data_schema` for automatic actions by adding status and system-generated fields.
- **`result_schema`** – validates the persisted revision format, including metadata and version history.

---

### 4.1 `params_schema`

Defined on all classes inheriting from `BaseAction`.
It describes the configuration stored on a `QuestionAdvancedFeature` when an action is enabled.

**Example: enabling Manual Transcription in English and Spanish**

```json
{
  "question_xpath": "audio_question",
  "action": "manual_transcription",
  "params": [{"language": "en"}, {"language":  "es"}]
}
```

**Example: enabling Qualitative Analysis Text question**

```json
{
  "question_xpath": "text_question",
  "action": "manual_qual",
  "params": [
    {
      "type": "qualSelectOne",
      "uuid": "1a8b748b-f470-4c40-bc09-ce2b1197f503",
      "labels": { "_default": "Was this a first-hand account?" },
      "choices": [
        { "uuid": "3c7aacdc-8971-482a-9528-68e64730fc99", "labels": { "_default": "Yes" } },
        { "uuid": "7e31c6a5-5eac-464c-970c-62c383546a94", "labels": { "_default": "No" } }
      ]
    },
    {
      "type": "qualInteger",
      "uuid": "1a2c8eb0-e2ec-4b3c-942a-c1a5410c081a",
      "labels": { "_default": "How many characters appear in the story?" }
    }
  ]
}
```

---

### 4.2 `data_schema`

Validates the **client payload** sent for a supplement.
Each action has its own expected format:

- **Manual Transcription**
  ```json
  { "language": "en", "value": "My transcript" }
  ```

- **Manual Transcription (with `locale`)**
  ```json
  { "language": "en", "locale": "en-US", "value": "My transcript" }
  ```

- **Manual Translation**
  ```json
  { "language": "en", "value": "My translation" }
  ```

- **Automatic Transcription / Automatic Translation**
  ```json
  { "language": "en" }
  ```

- **All actions – delete request**
  ```json
  { "language": "en", "value": null }
  ```

- **Qualitative Analysis**
  ```json
  {
    "uuid": "q_uuid",
    "value": "sentiment_pos"
  }
  ```

---

### 4.3 `external_data_schema`

Used only for **automatic actions** (`BaseAutomaticNLPAction`).
It validates the **augmented payload** returned by the external service.

- **Example (complete)**
  ```json
  { "language": "en", "value": "My automatic result", "status": "complete" }
  ```

- **Example (in progress)**
  ```json
  { "language": "en", "status": "in_progress" }
  ```

- **Example (deleted)**
  ```json
  { "language": "en", "status": "deleted", "value": null }
  ```

- **Example (failed)**
  ```json
  { "language": "en", "status": "failed", "error": "Could not process action" }
  ```

---

### 4.4 `result_schema`

Validates the **revision JSON** persisted in the database.
The structure is the same for both manual and automatic actions:

- Metadata about the action itself (`_dateCreated`, `_dateModified`).
- A list of versions under `_versions`, each containing:
  - A nested `_data` object with properties from either `data_schema` (manual) or `external_data_schema` (automatic).
  - Audit fields (`_dateCreated`, `_dateAccepted`, `_uuid`).

**Manual Action Example**

```json
{
  "_dateCreated": "2025-08-21T20:55:42Z",
  "_dateModified": "2025-08-21T20:57:28Z",
  "_versions": [
    {
      "_data": {
        "language": "en",
        "value": "My manual transcript"
      },
      "_dateCreated": "2025-08-21T20:57:28Z",
      "_dateAccepted": "2025-08-21T20:57:28Z",
      "_uuid": "4dcf9c9f-e503-4e5c-81f5-74250b295001"
    },
    {
      "_data": {
        "language": "en",
        "value": "My previous manual transcript"
      },
      "_dateCreated": "2025-08-21T20:55:42Z",
      "_dateAccepted": "2025-08-21T20:55:42Z",
      "_uuid": "850e6359-50e8-4252-9895-e9669a27b1ea"
    }
  ]
}
```

**Automatic Action Example**

```json
{
  "_dateCreated": "2025-08-21T20:55:42Z",
  "_dateModified": "2025-08-21T20:57:28Z",
  "_versions": [
    {
      "_data": {
        "language": "en",
        "value": "My automatic result",
        "status": "complete"
      },
      "_dateCreated": "2025-08-21T20:57:28Z",
      "_dateAccepted": "2025-08-21T20:57:28Z",
      "_uuid": "4dcf9c9f-e503-4e5c-81f5-74250b295001"
    },
    {
      "_data": {
        "language": "en",
        "value": "My previous automatic result",
        "status": "complete"
      },
      "_dateCreated": "2025-08-21T20:55:42Z",
      "_dateAccepted": "2025-08-21T20:55:42Z",
      "_uuid": "850e6359-50e8-4252-9895-e9669a27b1ea"
    }
  ]
}
```

**Qualitative Analysis Action Example**

```json
{
  "q1_uuid_here": {
    "_dateCreated": "2025-08-21T20:55:42Z",
    "_dateModified": "2025-08-21T20:57:28Z",
    "_versions": [
      {
        "_data": {
          "uuid": "q1_uuid_here",
          "value": "sentiment_pos"
        },
        "_dateCreated": "2025-08-21T20:57:28Z",
        "_dateAccepted": "2025-08-21T20:57:28Z",
        "_uuid": "4dcf9c9f-e503-4e5c-81f5-74250b295001"
      },
      {
        "_data": {
          "uuid": "q1_uuid_here",
          "value": "sentiment_neg"
        },
        "_dateCreated": "2025-08-21T20:55:42Z",
        "_dateAccepted": "2025-08-21T20:55:42Z",
        "_uuid": "850e6359-50e8-4252-9895-e9669a27b1ea"
      }
    ]
  },
  "q2_uuid_here": {
    "_dateCreated": "2025-08-21T20:55:42Z",
    "_dateModified": "2025-08-21T20:57:28Z",
    "_versions": [
      {
        "_data": {
          "uuid": "q2_uuid_here",
          "value": 8
        },
        "_dateCreated": "2025-08-21T20:57:28Z",
        "_dateAccepted": "2025-08-21T20:57:28Z",
        "_uuid": "91ab5f30-0f73-4e2e-b91f-8ad2f67a4729"
      }
    ]
  }
}
```

> For manual actions, the inner version objects correspond to `data_schema`.
>
> For automatic actions, they correspond to `external_data_schema`.

---

### 4.5 `result_schema` with dependencies

Some actions depend on the result of other actions.
For example, a **translation** action requires an existing **transcription**.
In this case, a `_dependency` property is added to the persisted JSON.

**Example: Automatic Translation result depending on an Automatic Transcription**

```json
{
  "_dateCreated": "2025-09-01T12:15:42Z",
  "_dateModified": "2025-09-01T12:17:28Z",
  "_versions": [
    {
      "_data": {
        "language": "fr",
        "value": "Mon audio a été traduit automatiquement",
        "status": "complete"
      },
      "_dateCreated": "2025-09-01T12:17:28Z",
      "_uuid": "91ab5f30-0f73-4e2e-b91f-8ad2f67a4729",
      "_dependency": {
        "_uuid": "4dcf9c9f-e503-4e5c-81f5-74250b295001",
        "_actionId": "automatic_google_transcription"
      }
    }
  ]
}
```

- The `_dependency` object references the transcription result that the translation was built upon.
- It reuses the UUID and action ID from the transcription’s persisted result, ensuring referential integrity.
- This allows clients to trace back a translation to the exact transcription version it relied on.
