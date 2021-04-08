# Locking TODO notes

// NOTE to self: please try to use "lockpick" name for anything

https://github.com/kobotoolbox/kpi/issues/3032

https://docs.google.com/spreadsheets/d/1JI2JQ2UFrPvUh3ZuwiAoMBrol_KshkIARloSTi6UOM4/edit#gid=1847621029

Things to actually do:
1. [x] restriction based UI changes (either attribute `disable` or hidden)
  - [x] disable change translation (outside form builder)
    - `asset.content` doesn't exist on assets in a list, so can't really hide the button to open translations modal
  - [x] disable replacing form button (outside form builder)
    - `asset.content` doesn't exist on assets in a list, so can't really hide the button to open translations modal
2. [ ] AssetsTable alternative type icon for `isAssetLocked`
  - can't do it because don't have access to `asset.content`

3. [ ] test Josh locking branch
4. [ ] write missing test

Tests:
- locking blocks
  1. upload XLS file with locking features
  2. it becomes a block not template
  3. see what happens in Form Builder
  4. see what happens if you "Add from Library" it to a template (does it retain it's locking profile?)

