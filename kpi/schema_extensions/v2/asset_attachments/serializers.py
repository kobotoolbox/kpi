from kpi.utils.schema_extensions.serializers import inline_serializer_class

from .fields import (
    SubmissionRootIdField
)


AssetAttachmentBulkRequest = inline_serializer_class(
    name='AssetAttachmentDeleteRequest',
    fields={
        'submission_root_uuids': SubmissionRootIdField(),
    },
)
