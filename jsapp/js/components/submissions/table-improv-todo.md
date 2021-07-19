TODO:

- apply user permissions to hiding and freezing

- move overrides to tableStore, only table store shouuld know about overrides
- make sortBy an override

freeze column and hide column requires:
this.userCan('change_asset', this.props.asset)