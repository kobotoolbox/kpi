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
