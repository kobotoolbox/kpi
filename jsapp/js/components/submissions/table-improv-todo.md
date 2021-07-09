TODO:

- hiding columns dropdown
  - add "APPLY" button
  - add note from the table settings modal:
    - "These settings affects the table experience for all users"
    - question mark icon link to support article
  - add "RESET" button that resets just the hidden columns

- apply user permissions to hiding and freezing

- move things (that makes sense) to `tableUtils` from `table`

freeze column and hide column requires:
this.userCan('change_asset', this.props.asset)