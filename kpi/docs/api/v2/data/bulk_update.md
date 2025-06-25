 ### Bulk updating of submissions


    > **Payload**
    >
    >        {
    >           "submission_ids": [{integer}],
    >           "data": {
    >               <field_to_update_1>: <value_1>,
    >               <field_to_update_2>: <value_2>,
    >               <field_to_update_n>: <value_n>
    >           }
    >        }

where `<field_to_update_n>` is a string and should be an existing XML field value of the submissions.
If `<field_to_update_n>` is part of a group or nested group, the field must follow the group hierarchy
structure, i.e.:

If the field is within a group called `group_1`, the field name is `question_1` and the new value is `new value`,
the payload should contain an item with the following structure:

<pre class="prettyprint">
"group_1/question_1": "new value"
</pre>

Similarly, if there are `N` nested groups, the structure will be:

<pre class="prettyprint">
"group_1/sub_group_1/.../sub_group_n/question_1": "new value"
</pre>
