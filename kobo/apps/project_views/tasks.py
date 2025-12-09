from kobo.celery import celery_app
from kpi.models import ProjectViewExportTask
from kpi.utils.export_cleanup import delete_expired_exports


@celery_app.task
def cleanup_project_view_exports(**kwargs):
    """
    Task to clean up export tasks created by Project Views that are older
    than `EXPORT_CLEANUP_GRACE_PERIOD`, excluding those that are still processing
    """
    delete_expired_exports(ProjectViewExportTask)
