# Superuser XForm XML Overwrite Endpoint

## Background

The KPI tool primarily operates on XLSForm, which is converted to XForm XML
by the pyxform library. However, it does store the resulting XML in the
database (the `xml` TextField on `kobo.apps.openrosa.apps.logger.models.XForm`)
and serves it to clients (ODK Collect, Enketo, etc.).

In the normal pipeline, the `xml` field is **read-only** in the API -- it can
only be changed indirectly by uploading a new XLS file, which pyxform then
converts. This makes it impossible to make targeted XML-level edits for
debugging or one-off fixes without going through the XLS round-trip.

This change adds a **superuser-only** endpoint that allows directly
overwriting the stored XForm XML via the API.

## Endpoint

```
PATCH /api/v1/forms/{pk}/xml
```

### Request

- **Authentication:** Token or session auth for a Django superuser.
- **Content-Type:** `application/json`
- **Body:**

```json
{
    "xml": "<?xml version=\"1.0\"?><h:html xmlns:h=\"...\" ...>...</h:html>"
}
```

### Responses

| Status | Meaning |
|--------|---------|
| 200 | XML overwritten successfully. Returns the full XForm serializer payload. |
| 400 | No `xml` field in the request body. |
| 403 | The authenticated user is not a superuser. |
| 404 | No XForm with the given `pk` exists (or the user lacks view access). |

### Example

```bash
curl -X PATCH \
  https://kf.example.com/api/v1/forms/12345/xml \
  -H "Authorization: Token SUPERUSER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"xml": "<?xml version=\"1.0\"?>..."}'
```

## Implementation Details

### What was changed

1. **`kobo/apps/openrosa/apps/api/viewsets/xform_viewset.py`** -- Added the
   `overwrite_xml` action to `XFormViewSet`:

   ```python
   @action(detail=True, methods=['PATCH'], url_path='xml')
   def overwrite_xml(self, request, pk=None, **kwargs):
   ```

   The action:
   - Checks `request.user.is_superuser` and returns 403 if not.
   - Reads the `xml` key from the JSON request body.
   - Sets `xform.xml` to the new value and calls `xform.save()`.
   - Returns the standard `XFormSerializer` response.

2. **`kobo/apps/openrosa/apps/api/tests/viewsets/test_xform_viewset.py`** --
   Added three test cases:
   - `test_overwrite_xml_as_superuser` -- happy path.
   - `test_overwrite_xml_forbidden_for_non_superuser` -- 403 for non-superuser.
   - `test_overwrite_xml_returns_400_without_payload` -- 400 when `xml` is
     missing.

### Why this approach is minimal and safe

- **No serializer changes.** The `xml` field stays in `read_only_fields` on
  `XFormSerializer`. The new action writes directly to the model, so the
  standard create/update paths are completely unaffected.

- **No URL/router changes.** The existing `MultiLookupRouter` auto-wires
  `@action` routes. The `url_path='xml'` kwarg makes the URL
  `/api/v1/forms/{pk}/xml`.

- **No permission class changes.** The `XFormPermissions.has_permission()`
  method raises `LegacyAPIException` (405) only for the standard mutating
  actions (`create`, `update`, `partial_update`, `destroy`). Because our
  action name is `overwrite_xml`, it falls through to the normal
  DRF permission flow, and the explicit `is_superuser` check in the action
  body provides the actual gate.

### What `XForm.save()` does with the new XML

When `xform.save()` is called, the model's `save()` method
(`kobo/apps/openrosa/apps/logger/models/xform.py`) runs several
re-derivation steps on the XML:

1. **`_set_title()`** -- Extracts `<h:title>` from the XML. If the model
   already has a `title` and it differs from the one in the new XML, the
   model's existing `title` wins and the XML is patched to match.

2. **`_set_id_string()`** -- Extracts the `id` attribute from the
   `<instance>` element.

3. **id_string consistency check** -- If the XForm already exists (`self.pk`
   is set) and the new id_string differs from the old one, `save()` raises
   `XLSFormError`. This is a safety net that prevents you from accidentally
   swapping in XML meant for a different form.

4. **`_set_encrypted_field()`** -- Derives the `encrypted` boolean from
   `self.json` (not from `self.xml`), so this is unaffected.

### Things to be aware of

- **The `json` field is NOT re-derived.** The `json` field on XForm is
  populated by pyxform during XLS-to-XForm conversion. Directly overwriting
  `xml` does not update `json`. For most debugging scenarios this is fine,
  but if your debugging requires a consistent `json` field, you would need
  to update it separately (e.g., via the Django shell or by extending this
  endpoint to accept an optional `json` field).

- **The `md5_hash` updates automatically.** It is a property computed on the
  fly from `self.xml`, so it immediately reflects the new XML.

- **Enketo caching.** Enketo may cache the form definition. After
  overwriting XML, you may need to flush Enketo's cache or wait for it to
  expire before the changes appear in web forms.

- **The `id_string` must match.** You cannot change the form's `id_string`
  via this endpoint. `XForm.save()` will reject XML whose `id_string`
  differs from the stored value. This is a good safety net.

## Running the Tests

```bash
python manage.py test kobo.apps.openrosa.apps.api.tests.viewsets.test_xform_viewset \
    -k overwrite_xml
```

Or run all three individually:

```bash
python manage.py test \
    kobo.apps.openrosa.apps.api.tests.viewsets.test_xform_viewset.TestXFormViewSet.test_overwrite_xml_as_superuser \
    kobo.apps.openrosa.apps.api.tests.viewsets.test_xform_viewset.TestXFormViewSet.test_overwrite_xml_forbidden_for_non_superuser \
    kobo.apps.openrosa.apps.api.tests.viewsets.test_xform_viewset.TestXFormViewSet.test_overwrite_xml_returns_400_without_payload
```
