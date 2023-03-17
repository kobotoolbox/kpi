## NLP Feature

This directory holds the code for Single Processing route and things related to
transcripts and translations. In near future we plan to have some Qualitative
Analysis features added.

## How it works in a nutshell

An `asset` (of type `survey`) has two new properties:

- `advanced_submission_schema` - Here we describe what kind of properties would
  be stored inside `advanced_features`. Whenever we `PATCH` the `asset`'s
  `advanced_features` object, Back end is verifying if the data matches
  the schema.
- `advanced_features` - It holds the list of languages being enabled for both
  transcript and translations.

NOTE: Front-end code uses name `transx` to mean both `transcript` and
`translation`.

### Step 1. Enabling advanced features for given asset

Whenever user visits Single Processing route for the first time for given
Project, we make a call for enabling `advanced_features`. Initially we enable
`transcript` and `translations`. We start with zero languages available (more on
this below) at first. Back end will search for all transcriptable questions
and include their names in schema.

Enabling advanced feature means simply that we set the schema to suggest that
transcript and translations will be added. Every Project starts with no
advanced features.

After activating the Project to use advanced features, you will find the actual
feature endpoint at `advanced_submission_schema.url`. We use this endpoint to:

1. `GET` with Submission ID (mandatory) - retrieves current transcript and
   translations for Project for given submission.
2. `POST` stires transcript/translation text.

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

Thankfully whenever we delete a transcript, Back end is cleaning up unnecessary
languages for us. So if user deletes that "Polish" translation - we make
a single call to API. We will end up with both changes: "Polish" translation
text is no longer present in `advanced_features`, and "Polish" language is no
longer enabled in `advanced_submission_schema` under `transcript`.
