## NLP Feature

This directory holds the code for Single Processing route and things related to
transcripts and translations. In near future we plan to have some Qualitative
Analysis features added.

## How it works in a nutshell

An `asset` (of type `survey`) has two new properties:
- `advanced_features` - We use this to enable features. We define `transcipt`
  and `translation` and manage their lists of enabled languages (language
  codes). By changing them we cause the Back end code to rebuild the schema.
- `advanced_submission_schema` - It describes what kind of additional data can
  be added to the submission object (inside `_supplementalDetails`). It holds
  a very detailed information for each of transcriptable questions (only some
  of the question types can be used with processing feature). Whenever we add
  a transcript or a translation Back end is verifying if the request data
  matches the schema.

Submission object has one new property:
- `_supplementalDetails` - Here the actual transcript and translation text is
  being stored.

NOTE: Front-end code uses name `transx` to mean both `transcript` and
`translation`.

### Step 1. Enabling advanced features for given asset

Every Project starts with no advanced features enabled.

Whenever user visits Single Processing route for the first time for given
Project, we make a call for enabling `advanced_features`. Initially we enable
`transcript` and `translation` with zero languages, because we don't know yet
in what languages user would add the text. Back end will search for all
transcriptable questions and include their names in schema.

After activating the Project to use advanced features, you will find the actual
feature endpoint at `advanced_submission_schema.url`. We use this endpoint in
two ways:

- `GET` with Submission ID (mandatory) - retrieves current transcript and
  translations for Project for given submission.
- `POST` stires transcript/translation text.

### Step 2. Adding a transcript or translation

NOTE: The text below will talk about transcript, but the same flow is being used
for translations.

Example: user saves their "Polish" transcript - the code does two things:

1. It checks if `transcript` in `advanced_fetures` for given `asset` has
   "Polish" language enabled.
2. If "Polish" is not enabled, we make a call to update the schema to include
   this language under `transcript`.
3. Finally we make a call (to the unique feature endpoint) to save the
   transcript text.

Thankfully whenever we delete a transcript, Back end is automagically cleaning
up unnecessary languages for us. So if user deletes that "Polish" transcript
(and no other submission has transcript in this language) we don't have to
remove the language from the schema ourselves. We simply make single API call
and end up with both changes:
- "Polish" transcript is no longer present in `_supplementalDetails`
- "Polish" language is no removed from `advanced_fetures`
