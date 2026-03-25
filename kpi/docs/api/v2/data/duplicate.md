## Duplicate submission

Duplicates the data of a submission

`{id}` can be:

- The primary key of the submission
- Its `_uuid` <sup>1</sup>
- Its `rootUuid` (without "uuid:" prefix)

<sup>1</sup> Please note that using the `_uuid` may match **several** submissions, only
the first match will be returned.
