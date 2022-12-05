# `subsequences` app

### Purpose:

* Allow pluggable python code to handle and process submission data
* Pass this data through to front end views and exports
* Allow targeting of specific users/groups/forms (not all code is sitewide)


### The name

* The name `subsequences` reflects the way the data is handled sequentially after submission or after another "action" has handled the data


## The code

### All actions must have the following components

* an identifier
* a method that decides if a given submission needs to be handled
* a handler that receives a submission (and other metadata) and processes it
* a jsonschema to validate that a response is valid

## An example

* A one question survey and we want to round down the decimal on the survey
  * `{
      "type": "decimal",
      "name": "fuel_cost"
    }`

#### step 1. subclass the "BaseAction"

We will define a class `DecimalRounder` that inherits from `subsequences.actions.BaseAction`

#### step 2. pick an identifier for the metadata

```python
from kobo.apps.subsequences import BaseAction
class DecimalRounder(BaseAction):
    ID = 'decimal_rounder'
```

#### step 3: when should a record should be modified or handled

In this example, we would probably want to handle any submission that has a non-null value in the `fuel_cost` field of the submission. We would define that like this:

```python
from subsequences.status ACTION_NEEDED, PASSES

class DecimalRounder(BaseAction):
    ID = 'decimal_rounder'
    def check_submission_status(self, submission):
        if submission.get('fuel_cost') != None:
            return ACTION_NEEDED
        return PASSES

## STEP 4: define the handler

    def run_change(self, submission):
        _data = submission.get(self._destination_field, {})
        fuel_cost = submission.get('fuel_cost')
        _data['rounded'] = round(fuel_cost * 100) / 100
        return {**submission, self._destination_field: _data}

```

#### Step 5: specify which surveys (`Asset`) should be passed to this handler

Somewhere, either through the API or elsewhere, add relevant details to the asset's `advanced_features` field:

```python
for asset in Asset.objects.filter(name__contains='fuel'):
    asset.advanced_features = {
        # 'decimal_rounder' is the ID of the action, defined above
        'decimal_rounder': {
            'decimal_rounder_fields': ['fuel_cost']
        }
    }
    asset.save()
```

#### Step 6: modify the `DecimalRounder` class to receive these params from `asset.advanced_features`

```python
from subsequences.status ACTION_NEEDED, PASSES

class DecimalRounder(BaseAction):
    ID = 'decimal_rounder'

    def load_params(self, params):
        # `params` is loaded from the asset
        self.fields_to_round = params['decimal_rounder_fields']

## STEP 7: modify `run_change` to use the params

    def run_change(self, submission):
        _data = submission.get(self._destination_field, {})
        for field in self.fields_to_round:
            fuel_cost = submission.get(field_name)
            _data[field_name] = round(fuel_cost * 100) / 100
        return {**submission, self._destination_field: _data}
```

#### Step 8: After a submission has come in, POST metadata to the `/advanced_submission_post/` API endpoint

```
POST to "/advanced_submission_post/aSsEtUiD"

{
  "submission": "submission-uuid",
  "fuel_cost": 1.23456
}
```

This will create a record in the `submission_extras` table with the following values:

```
GET "/advanced_submission_post/aSsEtUiD?submission=<submissionUuid>"

{
  "submission": "submissionUuid",
  "_supplementalDetails": {
    "rounded": {
      "fuel_cost": 1.23
    }
  }
}
```

#### Step 9 (optional): Define a validator

Because `advanced_submission_post` data can be sourced from anywhere, it should be validated. The prominent way to do this is with a jsonschema defined in the action class.

```python
class DecimalRounder(BaseAction):
    ID = 'decimal_rounder'
    # ...
    # `modify_jsonschema` appended to the class above
    def modify_jsonschema(self, schema):
        defs = schema.get('definitions', {})
        props = schema.get('properties', {})
        defs['roundedschemadef'] = {
            'type': 'number',
        }

        for field_name in self.fields_to_round:
            props[field_name] = {'$ref': '#/defs/roundedschemadef'}
```

#### Step 10: Test the module

There is a utility to help "kick the tires" of your action subclass.

`python manage.py runscript subsequences_action_test < params_plus_submission.json`

where `params_plus_submission.json` looks like this:

```json
{
  "advanced_features": {
      "decimal_rounder": {
          "decimal_rounder_fields": ["fuel_cost"]
      }
  },
  "submission": {
      "fuel_cost": 5.678901
  }
}
```

this should print out the resulting submission:

```
{
    "fuel_cost": 5.678901,
    "_supplementalDetails": {
        "fuel_cost": {
            "rounded": 5.68
        }
    }
}
```

## Further development

These modules can be used in sequence to allow connection to external services or pulling data from other forms.

It can be used to store large amounts of unstructured data so be sure to test the jsonschema to make sure that POSTed values pass narrowly.

jsonschema resources:
* [json-schema.org](https://json-schema.org/)
* [json-schema-validator](https://www.jsonschemavalidator.net/)

## Further development

The changes are triggered with a POST to `/advanced_submission_post/`, but in the future could be triggered automatically by a hook when a submission is first received into the system.
