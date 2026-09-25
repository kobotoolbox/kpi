# Form Builder — Design Reference

This document is intended to be read before writing code on the replacement form builder. It covers what the system does today, what the API contract is, what the backend handles vs what the frontend must handle, the xlform internals that matter, and the hard design problems that need a strategy before implementation begins.

---

## The Current System

The form builder is a CoffeeScript/Backbone application (`jsapp/xlform/`) built around a flat representation of XLSForm data. It creates new forms and edits existing ones, presenting an editing UI and serializing to a JSON structure that the API accepts.

The replacement will be a React implementation. The serialization format and API contract remain the same — only the frontend implementation changes.

The xlform codebase is organized as:
- `model.configs.coffee` — question type registry, all defaults
- `model.row.coffee` — individual question rows and their serialization
- `model.surveyFragment.coffee` — groups and repeats
- `model.survey.coffee` — top-level survey container; `toJSON`/`toFlatJSON`
- `model.inputParser.coffee` — flat-to-nested restructuring on load; translation normalization
- `view.rowSelector.coffee` — the question type picker UI; where "New Question" comes from
- `formBuilderUtils.ts` — `surveyToValidJson`, the translations hack (`nullifyTranslations`/`unnullifyTranslations`)

---

## The API Contract

### What the API sends (on load)

`asset.content` is a JSON object with:

```json
{
  "survey": [{ "type": "...", "name": "...", "label": "...", ... }],
  "choices": [{ "list_name": "...", "name": "...", "label": "..." }],
  "settings": { "id_string": "...", "title": "...", "default_language": "..." },
  "translations": ["English (en)", "French (fr)"],
  "translated": ["label", "hint"]
}
```

**Single/unnamed language** — `label` is a plain string:

```json
{ "type": "text", "name": "age", "label": "How old are you?", "required": false }
```

**Multiple named languages** — `label` and `hint` become positional arrays aligned to `translations`. `null` means no translation provided for that language:

```json
{
  "translations": ["English (en)", "French (fr)", "Turkish (tr)"],
  "translated": ["label", "hint"]
}
```

A fully-translated row:
```json
{
  "type": "select_one", "name": "Pick_a_color",
  "label": ["Pick a color", "Choisissez une couleur", "Bir renk seçin"],
  "hint":  ["Choose your favourite", "Choisissez votre préféré", "Favorinizi seçin"]
}
```

A partially-translated row (only English provided):
```json
{
  "type": "begin_group", "name": "group_oc7df70",
  "label": ["Group", null, null]
}
```

Choices follow the same pattern:
```json
{ "list_name": "colors", "label": ["blue", "Bleu", "Mavi"], "$autovalue": "blue" }
```

**`translations`** is a positional list of language names. The default language is always at index 0.

**`translated`** lists which field names use the positional-array format. Fields not in this list are plain strings even in translated forms.

**`settings`** arrives from the API as a plain object `{}`, not an array. xlform wraps it in a single-element array `[{}]` on serialize — this mirrors the XLSForm convention where every sheet is a table of rows (settings is a "sheet" with one row).

### What the API expects (on save)

- `label::lang` column syntax — xlform always sends this format; the backend normalizes it to positional arrays on save.
- `$kuid` — assigned once by the backend on first save and preserved on subsequent saves. The frontend should round-trip existing values unchanged and does not need to generate them for new rows.
- `$autoname`, `$xpath` — recomputed by the backend on every save. The frontend should preserve existing values during the session but does not need to generate them for new rows.
- Empty strings in `appearance`, `relevant`, `bind` are stripped by the backend. The replacement does not need to emit them. (`constraint` is NOT stripped — only the three listed fields.)

The minimum the frontend must send is a valid `survey` array with `type` on each row. Everything else is either preserved from the loaded content or computed by the backend. For a new form, `$kuid`s and `$autoname`s will be assigned by the backend on first save. `id_string` is set from `filename` if one exists in the asset summary, but for forms created purely in the builder it may remain unset until deployment.

### Language management boundary

Language add/remove is handled by `FormLanguagesManager` — a separate modal outside the form builder that directly PATCH-es the asset. The builder receives the current `translations` array and must not corrupt alignment during editing.

---

## What the Backend Computes

Understanding this prevents reimplementing things the backend handles for free.

### On every save (`adjust_content_on_save`)

| Function | What it does |
|---|---|
| `__normalize_settings_and_translations` | Unwraps settings array to dict; restores translations from DB if payload is missing them; suffixes plain strings with `::default_lang` for multilingual forms |
| `_standardize` → `expand_content` (formpack) | Normalizes `label::lang` column syntax → positional arrays; ensures `translations` and `translated` lists are populated; replaces type aliases. (formpack is an external dependency — this behavior is inferred from input/output observation, not source inspection.) |
| `_strip_empty_rows` | Removes survey rows with no `type`; removes choice rows with no `list_name` |
| `_assign_kuids` | Adds a `$kuid` to any row that lacks one — stable across saves |
| `_autoname` | Overwrites `$autoname` (sluggified from name or label) for every survey row; `$autovalue` for choice rows |
| `_insert_xpath` | Overwrites `$xpath` — slash-separated path like `group_name/question_name` |
| `_remove_empty_expressions` | Strips `appearance`, `relevant`, `bind` if value is `""` (NOT `constraint`) |

`$autoname` and `$xpath` are recomputed on every save and should not be treated as canonical. `$kuid` is stable — assigned once and preserved; it is the closest thing to a persistent row identifier the format has.

### On snapshot generation (before XML/XForm output)

This is the pipeline that runs when KoboCollect downloads a form, not on content save. The frontend-relevant implication is that `$autoname` values are promoted to `name` at this stage — unnamed questions in saved content survive until deployment.

### Autoname sluggification

The backend computes `$autoname` as follows: if a row has a `name` field, use it (sluggifying if it's not a valid XML node name); otherwise, sluggify from the first non-empty label. If both are absent, fall back to `type_$kuid`. The frontend xlform sluggification (`$utils.sluggifyLabel`) uses case-preserving options for group names and case-folding for question names. A replacement should defer to the backend for permanent names and only generate temporary names locally when needed for in-session skip logic references before the first save.

---

## xlform Internals

This section documents how xlform actually works, which informs both what the replacement must reproduce and what it should do differently.

### The translations hack (`nullifyTranslations` / `unnullifyTranslations`)

The input parser assumes `translations[0] === null` always. This is an explicit hack, labeled as such in the comments. The flow:

1. **On load:** `nullifyTranslations` stores the real `translations[0]` value into `_initialParams.translations_0`, then sets `translations[0] = null`. From this point, the internal representation uses `null` as the placeholder for "default language."
2. **During editing:** The bare field name (e.g. `label`) refers to the default language. Non-default languages use `label::LangName` column syntax. The `null` sentinel in `translations[0]` keeps `flatten_translated_fields` from generating a `"label::null"` key.
3. **On save:** `unnullifyTranslations` restores `translations[0]` from `_initialParams.translations_0`.

Consequence: the internal xlform representation is structurally different from both what arrives from the API and what is sent back. A replacement using keyed objects (`{ "English (en)": "text" }`) in memory avoids this entirely.

### `defaultsGeneral` vs `defaultsForType`

Two separate mechanisms, distinct in both timing and scope:

**`defaultsGeneral`** (in `view.rowSelector.coffee`): View-level defaults applied at click time by the UI, before the model row is created. The main relevant value is `label: "New Question"`. These are never written to the model — they are transient UI state. A `text` row created programmatically has no `label` field at all.

**`defaultsForType`** (in `model.configs.coffee`): Model-level defaults applied when any row of that type is created, regardless of UI context. These become actual model attributes. Examples: `integer` gets `label: "Enter a number"`, `calculate` gets `label: "calculation"` and `calculation: ""`, `select_one_from_file` gets `file: "DEFAULT_CHOICES_FILE"`.

The replacement must only implement `defaultsForType` equivalents (in the model/reducer). The "New Question" label for text is a UI concern only.

### `newRowDetails` — column defaults for every new row

These are applied to every new row regardless of type, via `_hideUnlessChanged` semantics:

```
name:               value: ""
type:               value: "text"
hint:               value: ""         _hideUnlessChanged: true
guidance_hint:      value: ""
required:           value: false      _hideUnlessChanged: true
relevant:           value: ""         _hideUnlessChanged: true
default:            value: ""         _hideUnlessChanged: true
constraint:         value: ""         _hideUnlessChanged: true
constraint_message: value: ""         _hideUnlessChanged: true
tags:               value: ""         _hideUnlessChanged: true
appearance:         value: ""         _hideUnlessChanged: true
```

`_hideUnlessChanged: true` means the field is omitted from serialized output unless the value has been changed to something other than the default. In practice: empty strings are never emitted. This is enforced in `toJSON2` with `if '' isnt result`.

### `_hideUnlessChanged` is a UI flag, not a serialization rule

The `_hideUnlessChanged` flag hides the field's input in the question editor UI. The field is still serialized normally if its value is non-empty. For `required` specifically: even when marked `_hideUnlessChanged`, the value `"false"` is still emitted in the serialized output. The UI just doesn't show the toggle.

Types where `required` is hidden in the UI (but still serializes as `"false"`): `calculate`, `hidden`, `note`, `geopoint`, `geotrace`, `geoshape`, `xml-external`.

### The internal type representation

xlform stores `select_one` type in a split form internally:
- `typeId` = `"select_one"`
- `listName` = `"colors"`

The `type` RowDetail's `value` property reconstructs `"select_one colors"` (space-joined) for internal use. On serialization via `toJSON2`, these are emitted as two separate fields: `type: "select_one"` and `select_from_list_name: "colors"`. `toFlatJSON` then re-joins them back to `"select_one colors"` for the flat survey array.

This split/rejoin cycle is purely internal to xlform. The API format uses the separate fields (`type` + `select_from_list_name`).

### Boolean serialization

`boolOutputs` maps `true → "true"` and `false → "false"`. All boolean values in serialized output are strings.

The input parser accepts a broader set: `truthyValues = ["yes", "YES", "true", "true()", "TRUE"]` and `falsyValues = ["no", "NO", "false", "false()", "FALSE"]`. Any other string (e.g. an XPath expression like `${q1}='yes'`) is passed through unchanged — this is how conditional required works.

### `toJSON` vs `toFlatJSON`

**`toJSON`**: Produces `{ survey: [...], choices: { listname: [...] } }` — choices are keyed by list name; empty strings are preserved. Used internally and for settings/CSV export.

**`toFlatJSON`**: Calls `toJSON`, then:
1. Re-joins split `select_one` types: `{type: "select_one", select_from_list_name: "list"} → type: "select_one list"`.
2. Flattens choices from `{listname: [...]}` to `[{list_name: listname, ...option}]`.
3. Wraps settings as `[@settings.attributes]` — a single-element array.
4. Preserves `lockingProfiles` if present.

The downstream consumer (`surveyToValidJson`) calls `toFlatJSON`.

### Group and repeat creation

Groups are added to the survey with `type: "group"` or `type: "repeat"` internally. `begin_group`/`begin_repeat` is NOT a valid type at the `addRow` stage — xlform throws `"Invalid type at this stage"` for these.

Group names are auto-generated **at construction time** using `group_<txtid()>` — a random 8-char hex string. This happens via a function value in `newGroupDetails`, not at finalize time. In contrast, question `$autoname` is computed at finalize time.

On serialization, groups emit:
- A `begin_group` (or `begin_repeat`) row with the group's attributes
- All child rows
- An `end_group` (or `end_repeat`) row with `$kuid: "/" + begin.$kuid`

The internal `_isRepeat` attribute is stripped from both begin and end output.

Groups also emit `appearance: ""` and `relevant: ""` even when unset — xlform artifacts. The backend's `_remove_empty_expressions` strips these immediately.

### The `$kuid` pairing convention

The `end_*` row's `$kuid` is always `"/" + begin_kuid`. This applies to: `end_group`, `end_repeat`, `end_score`, `end_rank`, `end_kobomatrix`. This slash-prefix convention is load-bearing — it is how begin/end pairs are linked. A replacement must preserve this.

### Choice list creation order (xlform API quirk)

When creating a `select_one` question programmatically in xlform:
1. Create the choice list first: `survey.choices.create()` — takes no arguments, generates a random `txtid` name.
2. Set its name: `list.set('name', 'mylist')`.
3. Add options: `list.options.add({...})`.
4. Then add the row, referencing the list.

If you add the row before the choice list exists, `linkUp` has nothing to resolve. Choice names are sluggified from labels: lowercase, stripped to alphanumeric.

### Score and Rank serialization

Score and Rank are composite types that serialize to multiple rows:

- The parent row's type is overwritten to `"begin_score"` / `"begin_rank"`.
- Sub-rows (`score__row`, `rank__level`) push their raw `@attributes` directly — no RowDetail unwrapping, no boolean conversion, no empty-string filtering. This is the rawest output in the system.
- An `_afterIterator` callback pushes `{type: "end_score"/"end_rank", $kuid: "/<parentKuid>"}`.
- Score/Rank choice lists are pushed to `additionalSheets['choices']` with `kobo--score-choices` / `kobo--rank-items` referencing the list name.

### SurveyDetail rows (metadata)

`start` and `end` metadata rows are **on by default** for all new forms and are included whenever a survey is created without explicit settings. These appear at the end of the survey array (after all user questions) and serialize as `{name: "start", type: "start"}` — both `name` and `type` have the same value.

All surveyDetails:

| Key | XLSForm name | Default on? | Notes |
|---|---|---|---|
| `start_time` | `start` | **yes** | |
| `end_time` | `end` | **yes** | |
| `startgeo` | `start-geopoint` | no | |
| `today` | `today` | no | |
| `username` | `username` | no | |
| `simserial` | `simserial` | no | `deprecated: true` — always forced to off regardless of saved value |
| `subscriberid` | `subscriberid` | no | `deprecated: true` — same |
| `deviceid` | `deviceid` | no | Alias: `"imei"` |
| `phoneNumber` | `phonenumber` | no | |
| `audit` | `audit` | no | |
| `bg_aud` | `background-audio` | no | |

Deprecated entries (`simserial`, `subscriberid`) are loaded but their value is forced back to `false` regardless of what the form contains.

### Skip Logic and Validation Logic — full implementation

Skip logic (`relevant`) and validation logic (`constraint`) share almost identical architecture. The only difference is the reference convention: skip logic uses `${question_name}`, validation logic uses `.` (dot = self-reference).

#### The state machine (three modes)

The skip logic editor is a state machine (`SkipLogicHelperContext`) with three mutually exclusive states:

1. **Mode selector** — Initial state when no logic is set. Shows two buttons: "Add a condition" (enters criterion builder) and "Manually enter your skip logic in XLSForm code" (enters hand-code mode).

2. **Criterion builder** — Structured UI. Each criterion is a triple: question picker → operator picker → response value input. Multiple criteria are joined by a single delimiter (`and` or `or` — mixed is not supported). The "add another condition" button appends empty criteria.

3. **Hand-code** — A freeform textarea for raw XPath. Used when the criterion builder can't represent the expression (complex XPath, unsupported operators, mixed join operators). Also accessible directly via the mode selector.

Transitions:
- Mode selector → criterion builder (if parseable) or hand-code (if not)
- Criterion builder → hand-code (via "switch editing mode")
- Hand-code → mode selector (via cancel/delete button)
- Criterion builder → mode selector (when all criteria are removed)

#### The parser

`model.skipLogicParser.coffee` uses a shared factory (`model.validationLogicParserFactory.js`) with four regex patterns:

| Pattern | Matches |
|---------|---------|
| `existenceCriterionPattern` | `${name} != ''` or `${name} = ''` |
| `equalityCriterionPattern` | `${name} = 'value'`, `${name} > 5`, `${name} = date('2024-01-01')` |
| `selectMultiplePattern` | `selected(${name}, 'choice')` or `not(selected(${name}, 'choice'))` |
| `criteriaJoinPattern` | ` and ` or ` or ` (splits multi-criteria expressions) |

The parser splits the full expression on ` and `/` or `, then matches each piece against the patterns above. If any piece fails to match, the entire expression is unparseable and the system falls back to hand-code mode.

**Hard limitation:** mixed join operators (`${a} = 1 and ${b} = 2 or ${c} = 3`) throw an error — the parser explicitly rejects them. Users who need grouped boolean logic must use hand-code mode.

#### Internal reference model (cid-based)

The criterion model (`SkipLogicCriterion`) stores references by Backbone `cid` — a transient client-side ID:

```coffeescript
# Internal storage
@set('question_cid', cid)

# Resolution at serialize time
@_get_question().finalize()       # ensures question has a name
questionName = @_get_question().getValue('name')
@get('operator').serialize(questionName, responseValue)
```

This means:
- **Rename is safe** while the form is open — the cid stays stable, the name is resolved fresh at serialize time.
- **Hand-coded expressions are NOT updated on rename** — they stay as literal text with the old `${name}`.
- **Delete propagates reactively** — the referenced question's `'remove'` event triggers `'remove:presenter'` on the dispatcher, which removes the criterion from the builder.
- **Reordering invalidates forward references** — `removeInvalidPresenters()` (fired on `'sortablestop'`) silently removes criteria that reference questions now positioned after the current row. No user notification.

#### Selectable rows (what can be referenced)

`selectableRows()` in `model.row.coffee` returns only questions that:
1. Precede the current row in document order (forward references are disallowed)
2. Are not one of these types: `datetime`, `time`, `note`, `calculate`, `group`, `kobomatrix`, `repeat`, `rank`, `score`

The question picker dropdown shows only these rows.

#### Operator types and question type compatibility

Each question type declares which operators it supports. Four operator categories:

| ID | Type | Label | Serializes as |
|----|------|-------|---------------|
| 1 | existence | "Was Answered" / "Was not Answered" | `${q} != ''` / `${q} = ''` |
| 2 | equality | "=" / "!=" | `${q} = 'val'` or `selected(${q}, 'val')` |
| 3 | greater | ">" / "<" | `${q} > val` / `${q} < val` |
| 4 | greater-eq | ">=" / "<=" | `${q} >= val` / `${q} <= val` |

Question type → supported operators:

| Type | Operators | Response input |
|------|-----------|----------------|
| `text`, `barcode` | existence, equality, greater, greater-eq | text field |
| `integer` | greater, existence, equality, greater-eq | validated integer field |
| `decimal` | existence, equality, greater, greater-eq | validated decimal field |
| `select_one` | equality, existence | dropdown of choices |
| `select_multiple` | equality, existence | dropdown of choices (uses `selected()` function) |
| `date` | equality, greater, greater-eq | text field (wraps in `date('...')`) |
| `geopoint`, `geotrace`, `geoshape`, `image`, `audio`, `video`, `acknowledge` | existence only | (none) |

When a criterion references a question whose type doesn't support the current operator, `_criteria_supported()` returns false and the entire expression falls back to hand-code mode.

#### Serialization chain

1. `SkipLogicDetailMixin.serialize()` → calls `@facade.serialize()`
2. `SkipLogicPresentationFacade.serialize()` → calls `@context.serialize()` (delegates to current state)
3. **Criterion builder state:** maps each presenter to its `model.serialize()`, joins with the delimiter string (` and ` or ` or `)
4. **Hand-code state:** returns the textarea value as-is
5. **Mode selector state:** returns `''`

Each `SkipLogicCriterion.serialize()` calls `finalize()` on the referenced question (ensures a name exists), then delegates to the operator class:
- `SkipLogicOperator`: `${name} <symbol> <value>`
- `TextOperator`: wraps value in single quotes, escapes internal quotes
- `DateOperator`: wraps value in `date('...')` if not already wrapped
- `ExistenceSkipLogicOperator`: always uses `''` as the value
- `SelectMultipleSkipLogicOperator`: `selected(${name}, 'value')` or `not(selected(${name}, 'value'))`

#### Validation logic differences

`constraint` uses the same architecture with these substitutions:
- Parser regex uses `(\\.)` (dot) instead of `\\$\\{(\\w+)\\}` (name reference)
- `select_multiple` pattern uses `selected(., 'value')` instead of `selected(${name}, 'value')`
- The criterion builder references the current question implicitly (no question picker needed)

#### Graceful degradation

If at any point the parser fails, `_criteria_supported()` returns false, or an exception is thrown, the system falls back to the hand-code textarea. The raw string is preserved — no data loss. This is critical: the structured builder only handles a subset of valid XPath; anything it can't represent must survive as a raw string.

### `linkUp` — skip logic wiring

After a row is created or loaded, `linkUp()` resolves name-based references into live in-memory handles (`question_cid`). On serialize, the serializer walks these handles to pick up the current name. This is how rename works without string search-and-replace.

Breaking change: if a referenced question is deleted, the handle becomes a dangling reference. xlform fails silently here — broken references produce an empty string on serialize. There is no cross-session integrity.

### Question type picker (view.rowSelector)

The picker is a two-step flow:
1. A "namer" form where the user types a question label.
2. The type picker grid.

The typed name is stored in `@question_name` across both steps. On selection:
1. If user typed something → use it as the label.
2. Else if type is in `defaultsForType` → use that type's default label.
3. Else → use `"New Question"` (from `defaultsGeneral`).

For `calculate`, the typed name is stored as `calculation`, not `label`. The `label` is always `"calculation"` from `defaultsForType`.

Types hidden from the picker unless files are available: `select_one_from_file`, `select_multiple_from_file`.

Type registered but never shown in the picker: `background-geopoint` (`supportedByUI: false`).

New rows are inserted after the currently selected row if one is focused, otherwise at index 0 (top of survey). After `addRow`, `newRow.linkUp()` is called immediately.

---

## Format Reference

Non-obvious format rules for the XLSForm JSON that the API accepts/returns.

### Question types and the API format

**`select_one` / `select_multiple`:** The `type` field is `"select_one"` — list name is a separate `select_from_list_name` field. Never concatenate them in the API format (though xlform does concatenate internally).

**`select_one_from_file` / `select_multiple_from_file`:** Inject `file: "DEFAULT_CHOICES_FILE"` on row creation. The user replaces this with the actual filename.

**`calculate`:** Expression stored in `calculation` field. Has a default `label: "calculation"` (both fields are present; the label is typically hidden in the UI but still serialized). The `required` field is also present as `"false"`.

**`range`:** Parameters stored as a semicolon-delimited string: `"start=0;end=10;step=1"`. Default values (`start=0`, `end=10`, `step=1`) ARE written at question creation time via `questionParams` defaults. Set via `row.setParameters()`.

**`image`:** `max-pixels` parameter uses single key=value without semicolons: `"max-pixels=2048"`. Default value `2048` IS written at question creation time. Format is different from range (no semicolons).

**`select_one` / `select_multiple` parameters:** `randomize` and `seed` are registered in `questionParams` but have no `defaultValue` — they are NOT written at creation time. Only emitted when explicitly set.

### Default labels (model-level, not UI-level)

These types have defaults written to the model at row creation. A replacement must set these in its reducer/model, not just as placeholder text:

| Type | Default label |
|---|---|
| `note` | `This note can be read out loud` |
| `integer` | `Enter a number` |
| `decimal` | `Enter a number` |
| `date` | `Enter a date` |
| `time` | `Enter a time` |
| `datetime` | `Enter a date and time` |
| `geopoint` | `Record your current location` |
| `geotrace` | `Record a line` |
| `geoshape` | `Record an area` |
| `barcode` | `Use the camera to scan a barcode` |
| `image` | `Point and shoot! Use the camera to take a photo` |
| `audio` | `Use the camera's microphone to record a sound` |
| `video` | `Use the camera to record a video` |
| `file` | `Upload a file` |
| `range` | `Enter a number within a specified range` |
| `acknowledge` | `Acknowledge` |
| `calculate` | `calculation` |
| `hidden` | `hidden` |
| `select_one_from_file` | `Select One from file` |
| `select_multiple_from_file` | `Select Multiple from file` |
| `xml-external` | `File_name` |

Types with **no** model-level default label (get "New Question" from the UI, or nothing if created programmatically): `text`, `select_one`, `select_multiple`, `score`, `rank`, `kobomatrix`.

### `required`

The backend accepts and stores any of:
- Boolean `true`/`false`
- String `"true"`/`"false"`
- An XPath expression string (e.g., `"${consent}='yes'"`) — conditional required

xlform serializes required as string `"true"` or `"false"`. The input parser normalizes boolean/string/truthy-string variants to `true`/`false` but passes through XPath expressions unchanged.

Types where the `required` UI toggle is hidden (`_hideUnlessChanged`): `calculate`, `hidden`, `note`, `geopoint`, `geotrace`, `geoshape`, `xml-external`. The field is still serialized as `"false"` for these types — the flag only controls the UI.

### Groups and repeats

`begin_group`/`end_group` and `begin_repeat`/`end_repeat` are matched pairs. The end row's `$kuid` is `"/" + begin.$kuid`. This convention must be maintained.

Group names use the format `group_<8-char-hex>` (e.g., `group_oc7df70`). Generated at construction time, not at save time.

Groups and repeats emit `appearance: ""` and `relevant: ""` even when unset — xlform artifacts. The backend strips these. The replacement does not need to emit them.

Group `required` is `false` (boolean, not string) when loaded from a fixture. This is because the input parser normalizes it on load but does not re-serialize it through `defaultsForType`. A replacement using booleans consistently is fine.

### `constraint` and `constraint_message`

Two independent top-level fields on a row. A question can have one without the other.

### Settings

`settings` arrives from the API as a plain object. `id_string` identifies the form definition and must be preserved on save when editing an existing form. For a new form, `id_string` is absent until the backend assigns it on first save — the frontend should not generate it. `form_title` is extracted by the backend and set as `asset.name`.

xlform wraps settings in a single-element array on serialize (`[{...}]`). The backend accepts both wrapped and unwrapped. A replacement can send a plain object.

### Cascading selects

Cascading selects work by sharing choice list names across questions: a child question's `choice_filter` references values from a parent question, and the child's `select_from_list_name` must match a list whose option names overlap with the parent list's option names. `linkUpChoiceLists` in xlform detects this overlap and wires the cascade. More than one overlapping list is treated as an error.

### The full question type list

Types exposed in the UI question picker:

```
select_one, select_multiple, text, integer,
decimal, date, time, datetime,
geopoint, image, audio, video,
geotrace, note, barcode, acknowledge,
geoshape, score, kobomatrix, rank,
calculate, hidden, file, range,
xml-external,
select_one_from_file*, select_multiple_from_file*
```

*Only shown when the form has associated files.

`background-geopoint` is registered in the model but excluded from the picker (`supportedByUI: false`). It can appear in a loaded form but cannot be added through the UI.

---

## Hard Problems

These require a deliberate design decision before implementation begins. Getting them wrong mid-build is expensive. Where recommendations appear below, they are LLM-generated suggestions — not team decisions.

### 1. Referential Integrity

Questions reference each other by name in `relevant`, `calculation`, `choice_filter`, and `constraint`. When a question is renamed or deleted, references elsewhere in the form may break.

**How xlform handles it:** References are raw strings at rest. On load, `linkUp()` parses them and resolves names to live in-memory Backbone handles (`question_cid`). Rename is lazy — serialize-time lookup picks up the current name. Delete causes the criterion to serialize as empty string (the handle resolves to null, so the criterion produces nothing). In multi-criteria expressions, only the broken criterion is dropped; surviving ones are preserved. This all happens silently — no user notification.

**The gap:** Cross-session integrity isn't handled. If a referenced question was deleted in a previous session and the form was saved with the now-broken expression, the broken reference is loaded and falls back to the freeform textarea with no warning. Within a session, rename and delete both work correctly via the cid-based mechanism (verified in tests).

**Decisions to make:**
- Update references automatically on rename, or flag them to the user?
- How do you detect all references when a change happens? (Names appear in free-text XPath expressions — you'd need to parse them all on every rename.)
- How do you handle broken references loaded from a saved form?

---

### 2. Choice List Ownership

Does a choice list belong to one question or can multiple questions share it?

**How xlform handles it:** Lists live in a global `survey.choices` collection and are referenced by name from rows. There is no enforced ownership. Clone a question → the clone references the same list. Delete a question → the list remains.

**Decisions to make:**
- When you clone a question, does it get its own list or share the original?
- When you delete a question, do you delete its list?
- When two questions share a list and one edits it, does the other see the change?
- How do you handle lists shared across cascading selects?

**Recommendation:** Own by default, share by explicit opt-in. Clone a question → clone the list. Delete a question → delete its list (unless explicitly shared). Cascading selects are the main legitimate shared-list use case and should be handled as a specific feature.

---

### 3. Translation Consistency

Every translatable field is a positional array indexed to `content.translations`. One missed insertion corrupts the entire form's language alignment silently.

**Scope:** Language add/remove is handled by `FormLanguagesManager` outside the form builder. The builder just receives the translation array and must not corrupt it during editing.

**How xlform handles it:** The translations hack (`nullifyTranslations`) converts the array to `label::LangName` column syntax internally. Any operation that adds a row must add the right number of `null` entries to each translated field. This is error-prone and the source of the "TRANSLATIONS HACK" comment.

**Decisions to make:**
- What is the canonical in-memory representation — positional arrays or keyed objects (`{ "English (en)": "text" }`)?

**Recommendation:** Keyed objects in memory — impossible to mis-align, impossible to corrupt. Serialize to positional arrays on save, using the `translations` order to zip the keys into positions. Never use positional arrays internally.

---

### 4. Name Generation and Stability

Names must be valid XML identifiers, unique across the form, and stable once set.

**What the backend does:** `$autoname` is computed on every save by `_autoname()`. The frontend doesn't need to persist it — but needs working names during the editing session for skip logic references before the first save.

**Decisions to make:**
- What sluggification rules? (The backend preserves case, replaces non-word characters with `_`, max 40 chars, deduplicates with a zero-padded numeric suffix like `_001`.)
- How do you distinguish user-set names from auto-generated ones?
- When do you generate a tentative name — on row creation, or only when needed for a reference?

---

### 5. XPath Inside Groups

A question inside a group has `$xpath = "group_name/question_name"`. The backend computes this on every save.

Note: xlform's skip logic uses bare `${name}` references regardless of group nesting — it does NOT use `$xpath`-style paths in `relevant` expressions. Whether the XForm runtime resolves bare names across group boundaries or requires full paths is an ODK/pyxform concern at deployment time, not something the form builder currently handles.

**What the backend does:** `$xpath` is computed on every save by `_insert_xpath()`. The frontend receives pre-computed values on load. The builder does not currently use `$xpath` for skip logic — it uses bare names.

**Decisions to make:**
- Does the replacement need to worry about XPath paths in skip logic at all, or is this entirely the backend/pyxform's concern?
- How do you handle references across repeat group boundaries? (Repeat children have different XPath semantics — they can be addressed as sets.)

---

### 6. Skip Logic and Validation UI

The structured criterion builder and the freeform XPath textarea must round-trip to the same underlying format. See "Skip Logic and Validation Logic — full implementation" in the xlform Internals section for complete details on the current system.

**What the criterion builder handles today:**
- Existence checks: `${q} != ''`
- Equality/inequality: `${q} = 'value'`, `${q} > 5`
- Date comparisons: `${q} = date('2024-01-01')`
- Select multiple: `selected(${q}, 'choice')` / `not(selected(${q}, 'choice'))`
- Multiple criteria joined by a single operator: `${a} > 0 and ${b} != ''`
- Self-reference in constraints: `.` instead of `${name}`

**What forces hand-code fallback (cannot be represented in the structured builder):**
- Mixed join operators: `${a} = 1 and ${b} = 2 or ${c} = 3`
- Nested functions: `concat()`, `string-length()`, `count()`, etc.
- Complex boolean logic with grouping: `(${a} or ${b}) and ${c}`
- Operators unsupported for the question type (e.g., `>` on a text question)
- Any expression the regex parser can't match

**How xlform handles it:** Backbone-linked live objects keyed by cid, built during `linkUp`. Serialize by walking criterion objects to resolve current names. Falls back to freeform textarea if the XPath can't be parsed into the structured model — no data loss, but no structured editing either.

**Silent failure modes in xlform:**
- Reordering rows silently removes criteria that now reference questions positioned after the current row (no user notification)
- Deleting a referenced question produces an empty string on serialize if the skip logic editor is not open
- Hand-coded expressions are never updated on rename — they keep the old `${name}` literally

**Decisions to make:**
- Internal representation: parsed AST, or raw string with parse-on-display? (AST enables validation and rename propagation; raw string is simpler but reproduces xlform's fragility)
- For XPath the structured builder can't represent, fall back to freeform with what UX? (xlform provides no warning — should the replacement show which expressions are unparseable and why?)
- Mixed `and`/`or`: support grouped boolean logic in the builder, or accept freeform as the only option?
- Skip logic (`relevant`) and validation (`constraint`) differ only in the reference convention (`.` vs `${name}`) — same component with a mode flag, or separate?
- How aggressively to propagate renames: only within structured criteria? Also in hand-coded expressions (via string replacement)? With undo?
- Conditional required: `required` can hold an XPath expression, not just `true`/`false`. Should this use the same criterion builder UI, or is it rare enough for a simple textarea?

---

## Architecture Recommendations

> **Note:** These recommendations are LLM-generated suggestions based on studying the xlform codebase. Not approved — may change as implementation begins.

Based on what was learned studying xlform and the backend:

### Data model: tree, not flat array

Store the form as a tree in memory — groups contain their children as a nested array. Convert to the flat `begin_group`/`end_group` format only at serialize time.

xlform does actually restructure the flat input into a tree of nested Backbone collections on load (`parseArr`), and flattens it back on serialize (`forEachRow`/`_beforeIterator`/`_afterIterator`). The flat representation causes friction at the seams: `begin_group`/`end_group` are invalid at the `addRow` call site (callers must use `type: "group"` instead), begin/end pairing requires the slash-prefix `$kuid` convention as a workaround for the lack of structural relationship, and `parseArr` throws if begin/end counts don't match — an entire error class that a tree structure avoids. The xlform source also contains an explicit `"BAD CODE™"` comment in `_insertRowInPlace` where `row._parent` is forcibly reassigned after a move.

The recommendation is to do the same flat ↔ tree conversion at the serialization boundary, but with plain data structures that work naturally with `useReducer` rather than mutable Backbone collections.

### Translations: keyed objects, not positional arrays

```ts
type TranslatedField = string | Record<string, string | null>
// e.g. { "English (en)": "How old are you?", "French (fr)": null }
```

Convert to positional arrays at serialize time. Never store translations as positional arrays internally.

### UUID-based references for skip logic

Use UUIDs as stable row identifiers instead of names. The skip logic editor stores `{rowUuid, operator, value}` triples. On serialize, resolve UUIDs to current names. On load, parse XPath expressions and resolve names to UUIDs. This is what xlform's `linkUp` attempts with Backbone CIDs, but UUIDs survive serialization.

### State management

`useReducer` + `useContext` — avoid adding new dependencies. The form state is a pure data structure that can be manipulated by a reducer with well-typed action types. The reducer handles all invariants (name deduplication, kuid pairing, translation alignment) as part of action processing.

### Choice lists: owned by default

Each select question owns its choice list. The list lives in the question node, not in a global collection. Cascading selects share by explicit reference — a `cascadeSource` pointer to another question's list. This makes ownership unambiguous and deletion safe.

### Separate the xlform adapter

Keep `XlformAdapter` as the boundary between xlform's CoffeeScript world and the React world. The adapter handles the translations hack, the settings array wrapping, and the type concatenation. The React app never imports xlform directly.

---

## Test Suite

The `__tests__/` directory contains tests that run against the current xlform implementation. They document serialization behavior as concrete assertions.

### What they do

- **Assert the serialized output format.** Load a form (or create one from scratch), optionally mutate it, serialize, and check the JSON. These are the format specs the replacement must match.
- **Cover mutations.** Adding rows, changing labels, deleting rows, moving rows, grouping/ungrouping, editing choices — all go through load → mutate → serialize and assert the result.
- **Document skip logic behavior.** Round-trip preservation of `relevant` and `constraint` expressions, rename propagation via the cid mechanism, and what happens when referenced questions are deleted.
- **Document multi-language editing.** Setting non-default language labels on existing rows, the gap where new rows don't get non-default language details automatically, and using `setDetail` to create them.
- **Pin down non-obvious format rules.** Boolean-to-string coercion for `required`, type/list_name splitting for selects, `$kuid` pairing on groups, parameter string formats, default labels per type.

### What they don't do

- **No UI testing.** These are model-layer tests only. The skip logic criterion builder, the question type picker, drag-and-drop reordering UI, and all view code are untested here.
- **No backend round-trip.** Tests serialize to JSON but never send it to the API. They don't verify that the backend accepts the output or that `expand_content` normalizes it correctly.
- **No creation-from-empty for most types.** Most tests load from fixtures. The `question-types/` tests do create rows from scratch, but only in single-language forms with no pre-existing content.
- **No language add/remove.** Adding or removing a language from the form's `translations` array is not covered (this is handled by `FormLanguagesManager` outside the builder).
- **No cascading selects, score, rank, or kobomatrix.** These complex composite types are not exercised.
- **No skip logic expression building.** The structured criterion builder (question picker → operator → value) is view code and can't run without a DOM. Only the serialization side of already-parsed expressions is tested.

### Structure

```
__tests__/
├── helpers.ts                    — shared utilities (loadSurvey, serialize, findRowByAutoname, etc.)
├── fixtures/                     — real API responses (structural-nesting, translated)
├── question-types/               — one file per type, asserts create-from-scratch output
│   ├── text, calculate, image, range, select-one, select-one-from-file, group
│   └── default-labels.tests.ts  — all 16 types with model-level defaults in one file
└── features/                     — cross-cutting behaviors
    ├── editing.tests.ts          — the main mutation suite (add, change, delete, move, group, choices, translations)
    ├── translations.tests.ts     — multi-language label editing, new row behavior in translated forms
    ├── skip-logic.tests.ts       — relevant/constraint round-trip, rename propagation, deletion behavior
    ├── required.tests.ts         — boolean coercion, group vs question differences
    ├── constraint.tests.ts       — constraint/constraint_message as siblings
    └── nesting.tests.ts          — $xpath format from fixtures
```

### How to run

```sh
npx jest --config ./jsapp/jest/unit.config.ts --testPathPatterns "formBuilder/__tests__"
```

### Using these tests for the replacement

The tests import `helpers.ts` which wraps xlform directly. To use them as a spec for the replacement:

1. Write a new `helpers.ts` that wraps the replacement's model layer instead of xlform.
2. Keep the same function signatures (`loadSurvey`, `serialize`, `addRow`, `findRowByAutoname`, `setLabel`).
3. Run the same test files — they should pass against the new implementation without modification.

The fixtures and assertions are the contract; the helpers are the swappable adapter.
