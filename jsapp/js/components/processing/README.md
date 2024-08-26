# NLP Feature

This directory holds the code for the Single Processing route, and things
related to transcripts and translations. In the near future, we plan to have
some Qualitative Analysis features added.

> Note: Front-end code uses the name `transx` to mean both `transcript` and
`translation`.

## How it works (in a nutshell)

An `asset` (of type `survey`) has two new properties:
- `advanced_features`
   - We use this to enable features. We define `transcript` and `translation`,
     and manage their lists of enabled languages (language codes). By changing
     them, we cause the Back end code to rebuild the schema.
- `advanced_submission_schema`
   - Describes what kind of additional data can be added to the submission 
     object (inside `_supplementalDetails`). It holds a very detailed
     information for each of "transcriptable" questions — only some of
     the question types can be used with processing feature. Whenever we add
     a transcript or a translation, the Back end is verifying if the request
     data matches the schema.

The Submission object has one new property:
- `_supplementalDetails` - Here the actual transcript and translation text is
  being stored.

### Step 1. Enabling advanced features for given asset

Every Project starts with no advanced features enabled.

Whenever the user visits the Single Processing route for the first time for
a given Project, we make a call for enabling `advanced_features`. Initially, we
enable `transcript` and `translation` with zero languages, because we don't know
in what languages user would add the text yet. The Back end will search for all
transcriptable questions and include their names in schema.

After activating the Project to use advanced features, you will find the actual
feature endpoint at `advanced_submission_schema.url` (it should be something
like `/advanced_submission_post/<uid>`). We use this endpoint in two ways:

- `GET` with Submission ID (mandatory) - retrieves current transcript and
  translations for Project for given submission.
- `POST` stores transcript/translation text.

### Step 2. Adding a transcript or translation

> Note: The text below will talk about adding a transcript, but the same flow is 
being used for adding translations, too.

Example: A user saves their "Polish" transcript.

1. We check if `asset` has `advanced_features` enabled (by default it's not enabled).
2. If there are no `advanced_features`, we make a call to enable it.
3. We check if `transcript` in `advanced_features` for given `asset` has "Polish" language enabled.
4. If "Polish" is not enabled, we make a call to update the schema to include this language under `transcript`.
5. Finally, we make a call (to the unique feature endpoint - `advanced_submission_post`) to save the transcript text.

Thankfully, whenever we delete a transcript, the Back end is automagically
cleaning up unreferenced languages for us. So if user deletes that "Polish"
transcript (and no other submission has a transcript in this language) we don't
have to remove the language from the schema ourselves. We simply make single API
call and end up with both changes:
- "Polish" transcript is no longer present in `_supplementalDetails`
- "Polish" language is now removed from `advanced_features`

## How automatic flow works

Transcription and translation work similarly.

Example: User already has some translations, and wants to create "German"
translation.

1. User enters the Single Processing route and proceeds to "Translation" tab.
2. Here they use "+ new translation" button.
3. They find and select "German", and use "automatic" button.
4. Here they use "create translation" button.
5. Front-end code makes a `POST` call to `advanced_submission_post`.
6. Initial response is of `requested` status, then it changes to `in_progress`
   and Back-end code starts the translation process.
7. Front-end code makes a `GET` call in a smart interval, checking if the status
   of the automated translation changed. In the mean time the UI displays some
   pending/estimation information.
8. Upon `error` a notification appear, upon `success`, the translation text is
   being opened in the editor. If user saves the editor, translation will be
   stored, if they don't, it would not.
