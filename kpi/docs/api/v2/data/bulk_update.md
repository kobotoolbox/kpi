## Bulk updating of submissions

Where `<field_to_update_n>` is a string and should be an existing XML field value of the submissions.
If `<field_to_update_n>` is part of a group or nested group, the field must follow the group hierarchy
structure, i.e.:

If the field is within a group called `group_1`, the field name is `question_1` and the new value is `new value`,
the payload should contain an item with the following structure:

*"group_1/question_1": "new value"*


Similarly, if there are `N` nested groups, the structure will be:

*"group_1/sub_group_1/.../sub_group_n/question_1": "new value"*
