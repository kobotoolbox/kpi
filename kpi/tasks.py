# coding: utf-8
from celery import shared_task
from django.core.management import call_command


@shared_task
def import_in_background(import_task_uid):
    from kpi.models.import_export_task import ImportTask  # avoid circular imports

    import_task = ImportTask.objects.get(uid=import_task_uid)
    import_task.run()


@shared_task
def export_in_background(export_task_uid):
    from kpi.models.import_export_task import ExportTask  # avoid circular imports

    export_task = ExportTask.objects.get(uid=export_task_uid)
    export_task.run()


@shared_task
def sync_kobocat_xforms(
    username=None,
    quiet=True,
    populate_xform_kpi_asset_uid=False,
    sync_kobocat_form_media=False,
):
    call_command(
        'sync_kobocat_xforms',
        username=username,
        quiet=quiet,
        populate_xform_kpi_asset_uid=populate_xform_kpi_asset_uid,
        sync_kobocat_form_media=sync_kobocat_form_media,
    )


@shared_task
def sync_media_files(asset_uid):
    from kpi.models.asset import Asset  # avoid circular imports

    asset = Asset.objects.get(uid=asset_uid)
    asset.deployment.sync_media_files()
