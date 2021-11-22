!!!!
!!  !!!!
 !!!!! !!!
! !! ! ! !!!!
!!!!!!!!!

write down pseudo code what calls I need to make for NLP
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!


## Notes

- I'm using incremental id for submissions now, but can switch to other id
- transcript/translation content is a string
- transcript/translation is unique per given language code, so I am using language codes as identifiers (e.g. you can't add english translation, if you already have english transcript, or add polish translation if you already have polish translation)
- transcript and translation data object is identical, the difference can be the "type" property if we use it
- transcript and translations could be stored together or separately
  ```
  // Same place, a way to distinguish them
  [
    {
      languageCode: "en",
      type: "transcript",
      content: "Some english transcript content.",
      dateCrated: "2000-01-1T10:00:00.000Z",
      dateModified: "2000-01-1T10:00:00.000Z"
    },
    {
      languageCode: "pl",
      type: "translation",
      content: "Jakaś polska zawartość.",
      dateCrated: "2000-01-1T10:00:00.000Z",
      dateModified: "2000-01-1T10:00:00.000Z"
    },
  ]
  ```

  ```
  // Different place, identical objects
  {
    transcript: {
      languageCode: "en",
      type: "transcript",
      content: "Some english transcript content.",
      dateCrated: "2000-01-1T10:00:00.000Z",
      dateModified: "2000-01-1T10:00:00.000Z"
    },
    translations: [
      {
        languageCode: "pl",
        type: "translation",
        content: "Jakaś polska zawartość.",
        dateCrated: "2000-01-1T10:00:00.000Z",
        dateModified: "2000-01-1T10:00:00.000Z"
      }
    ]
  }
  ```

## Transcripts

Transcript object is:

```
{
  languageCode: string
  content: string
  dateCrated: string
  dateModified: string
}
```

1. create transcript 
  - sending:
    - asset uid
    - question name
    - submission id
    - language code
    - content
  - response: the created transcript object
2. update transcript 
  - sending:
    - asset uid
    - question name
    - submission id
    - language code
    - content
  - response: the updated transcript object
3. delete transcript 
  - sending:
    - asset uid
    - question name
    - submission id
    - language code
  - response: nothing
4. get transcript
  - sending:
    - asset uid
    - question name
    - submission id
    - language code (or no language code needed, if we use the assumption there is only one or zero transcripts?)
  - response: transcript object

## Translations 

Translation object is:

```
{
  languageCode: string
  content: string
  dateCrated: string
  dateModified: string
}
```

1. create translation 
  - sending:
    - asset uid
    - question name
    - submission id
    - language code
    - content
  - response: the created translation object
2. update translation 
  - sending:
    - asset uid
    - question name
    - submission id
    - language code
    - content
  - response: the updated translation object
3. delete translation 
  - sending:
    - asset uid
    - question name
    - submission id
    - language code
  - response: nothing
4. get translation
  - sending:
    - asset uid
    - question name
    - submission id
    - language code
  - response: translation object
5. get translations
  - sending:
    - asset uid
    - question name
    - submission id
  - response: array of translation objects

## Data for Table View

Here I would assume that the additional columns are added to the submissions in the `api/v2/assets/apWDED7hy3JVJXxzzUnCip/data/`


transcriptTab:
- step begin (no transcript)
  - action: open configuration
- step configuration (choose language, choose manual or automatic)
  - action: set language
  - action: 
- step mode selector
  - substep pending automation
- step edit/create transcription (cancel editing/creating or save)
- step view transcription (edit or delete)
- step automatic (TBD)

transcriptTab step identification:
- begin:
  - transcript: undefined
- configure:
  - transcript.language: undefined
  - transcript.content: undefined
- mode selector:
  - transcript.language: string
  - transcript.content: undefined
- view:
  - transcript.language: string
  - transcript.content: string
- edit:
  - transcript.language: string
  - transcript.content: string
  
- should view/edit be the same?

store
- transcript: undefined | object
  - transcript.language: undefined | string
  - transcript.content: undefined | string
  - transcript is loaded from endpoint on init
  - transcript is being overwritten (or has local "working" version?)
  - you can change working version or save it?
- translations: []
  - translation.language
  - translation.content
  - a working version of translation
- - currentTab

translateTab:
- step begin (no translations)
- step configuration (language selector)
- step mode selector
- step pending automation
- step editor
- step view

- step begin with list of all translations?

- left side can display a transcript or translation