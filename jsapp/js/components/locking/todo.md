# Locking TODO notes

// NOTE to self: please try to use "lockpick" name for anything

https://github.com/kobotoolbox/kpi/issues/3032

https://docs.google.com/spreadsheets/d/1JI2JQ2UFrPvUh3ZuwiAoMBrol_KshkIARloSTi6UOM4/edit#gid=1847621029

Things to actually do:
1. [ ] restriction based UI changes (either attribute `disable` or hidden)
  - [ ] disable change translation (outside form builder)
  - [ ] disable replacing form button (outside form builder)
2. [ ] AssetsTable alternative type icon for `isAssetLocked`
3. [ ] test Josh locking branch
4. [ ] write missing test

Tests:
- locking blocks
  1. upload XLS file with locking features
  2. it becomes a block not template
  3. see what happens in Form Builder
  4. see what happens if you "Add from Library" it to a template (does it retain it's locking profile?)

