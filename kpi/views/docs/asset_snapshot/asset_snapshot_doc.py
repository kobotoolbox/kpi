asset_snapshot_list = """
Get list of snapshots for an asset.
"""

asset_snapshot_retrieve = """
Get a snapshot of an asset
"""

asset_snapshot_create = """
Create a snapshot of an asset
"""

asset_snapshot_destroy = """
Delete a snapshot of an asset
"""

asset_snapshot_update = """
Update a snapshot of an asset
"""

asset_snapshot_partial_update = """
Partial update a snapshot of an asset
"""

form_list_method = """
Implements part of the OpenRosa Form List API.
This route is used by Enketo when it fetches external resources.
It lets us specify manifests for preview
"""

manifest_method = """
Implements part of the OpenRosa Form List API.
This route is used by Enketo when it fetches external resources.
It returns form media files location in order to display them within
Enketo preview
"""

submission_method = """
Implements the OpenRosa Form Submission API
"""

xform_method = """
This route will render the XForm into syntax-highlighted HTML.
It is useful for debugging pyxform transformations
"""

xlm_method = """
Same behaviour as `retrieve()` from DRF, but makes it easier to target
OpenRosa endpoints calls from Enketo to inject disclaimers (if any).
"""
