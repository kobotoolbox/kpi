import re
from typing import Optional

from django.core.files.base import ContentFile
from django.db import IntegrityError, transaction

from kpi.constants import SUBMISSION_FORMAT_TYPE_XML
from kpi.models.asset_file import AssetFile
from kpi.models.paired_data import PairedData
from kpi.renderers import SubmissionXMLRenderer
from kpi.utils.hash import calculate_hash
from kpi.utils.xml import add_xml_declaration, strip_nodes


def build_and_save_paired_data_xml(
    asset,
    asset_file: AssetFile,
    paired_data: PairedData,
    source_asset,
    old_hash: Optional[str] = None,
) -> str:
    """
    Generates the XML file for a paired data link from the source submissions.

    Saves the result to `asset_file` and syncs the hash to the deployment
    backend if there are submissions and the content has changed. Returns the
    generated XML string regardless (including the empty-submissions case,
    which is returned as-is without saving so it is not cached, and the case of
    a concurrent request that has created the row first).
    """
    submissions = source_asset.deployment.get_submissions(
        asset.owner,
        format_type=SUBMISSION_FORMAT_TYPE_XML,
    )
    parsed_submissions = []
    allowed_fields = paired_data.allowed_fields
    # `allowed_fields` semantics (see `PairedData.allowed_fields`):
    #   None  → no restriction from either side; keep all fields.
    #   []    → source and destination restrictions do not overlap;
    #           no data should be exposed — skip submission parsing.
    #   [...]  → keep only the listed fields.
    if allowed_fields is None or allowed_fields:
        for submission in submissions:
            # Use `rename_root_node_to='data'` to rename the root node of
            # each submission to `data` so that form authors do not have to
            # rewrite their `xml-external` formulas any time the asset UID
            # changes, e.g. when cloning a form or creating a project from
            # a template. Set `use_xpath=True` because `paired_data.fields`
            # uses full group hierarchies, not just question names.
            parsed_submissions.append(
                strip_nodes(
                    submission,
                    allowed_fields,
                    use_xpath=True,
                    rename_root_node_to='data',
                )
            )

    root_tag_name = SubmissionXMLRenderer.root_tag_name
    xml_ = add_xml_declaration(
        f'<{root_tag_name}>' f'{"".join(parsed_submissions)}' f'</{root_tag_name}>'
    )

    if not parsed_submissions:
        # Do not cache an empty file; return the empty structure as-is.
        return xml_

    # Minify once here so the stored bytes, the hash, and the served bytes
    # are all consistent — avoiding a redundant O(n) regex on every request.
    xml_ = re.sub(r'>\s+<', '><', xml_).strip()

    filename = paired_data.filename

    # Lock the row only while the file is swapped, not while submissions are
    # fetched. `asset_file` may have been loaded long ago, so read the current
    # file name from the locked row to delete exactly what gets replaced.
    # Readers do not take this lock and keep serving the current file.
    previous_name = None
    try:
        with transaction.atomic():
            if asset_file.pk:
                previous_name = (
                    AssetFile.objects.select_for_update()
                    .filter(pk=asset_file.pk)
                    .values_list('content', flat=True)
                    .first()
                )
            asset_file.content = ContentFile(xml_.encode(), name=filename)
            asset_file.set_md5_hash(calculate_hash(xml_, prefix=True))
            asset_file.save()
    except IntegrityError:
        # The only expected case is a duplicate `uid`: a concurrent request has
        # created the row first, and it takes care of the backend sync. Remove
        # the upload of this request, unless both requests wrote to the same key.
        existing_file = AssetFile.objects.filter(uid=asset_file.uid).first()
        if asset_file.pk or not existing_file:
            raise
        if asset_file.content.name != existing_file.content.name:
            asset_file.content.storage.delete(asset_file.content.name)
        return xml_

    try:
        if old_hash != asset_file.md5_hash:
            asset.deployment.sync_media_files(AssetFile.PAIRED_DATA)
    finally:
        # Delete the replaced file only once the row points to the new one, so
        # that a concurrent request can still read it until then.
        if previous_name and previous_name != asset_file.content.name:
            asset_file.content.storage.delete(previous_name)

    return xml_
