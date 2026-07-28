from django.conf import settings
from django.db import migrations
from django.db.utils import OperationalError, ProgrammingError

FAILED_TAG = 'kobo-root-uuid-failed-0027'
DEPENDENT_MIGRATIONS = [
    '0027_backfill_remaining_root_uuid',
    '0028_sync_mongo_root_uuid',
]


def reprocess_failed_xforms(apps, schema_editor):
    """
    Remove the `kobo-root-uuid-failed-0027` tag from every XForm that LRM 0027
    wrongly flagged, then reset LRM 0027 and 0028 to `created` so they run again
    over those XForms.

    Done here rather than in an LRM job so both steps land at deploy time,
    before the workers restart. The order matters: if the tag were removed later
    (by a job), 0027 would re-run and complete before the detag, leaving the
    XForms excluded forever.

    The tag lives in the KoboCAT DB while the `LongRunningMigration` rows live in
    the default DB, so the two writes cannot share a transaction. The migration
    is therefore non-atomic and the reset runs *before* the delete: whenever a
    tag is removed, the matching reset has already been committed. If the process
    dies in between, a re-run finds the tags already gone but 0027 and 0028
    already reset, so the reprocessing is never silently lost.
    """

    TaggedItem = apps.get_model('taggit', 'TaggedItem')

    LongRunningMigration = apps.get_model(
        'long_running_migrations', 'LongRunningMigration'
    )

    # Filtering by `content_type` app_label and model avoids `get_for_model()`
    # and its per-connection cache.
    tag_filter = dict(
        tag__name__contains=FAILED_TAG,
        content_type__app_label='logger',
        content_type__model='xform',
    )

    try:
        has_failed_xforms = (
            TaggedItem.objects.using(settings.OPENROSA_DB_ALIAS)
            .filter(**tag_filter)
            .exists()
        )
    except (OperationalError, ProgrammingError):
        # Fresh install: KPI migrations run before the KoboCAT ones, so the
        # taggit tables (or the KoboCAT DB) may not exist yet. There are no
        # submissions, hence nothing to reprocess.
        return

    if not has_failed_xforms:
        # Nothing was skipped; leave 0027 and 0028 alone, so their (possibly
        # expensive) re-run is not triggered for nothing.
        return

    LongRunningMigration.objects.filter(name__in=DEPENDENT_MIGRATIONS).update(
        status='created', error=''
    )

    TaggedItem.objects.using(settings.OPENROSA_DB_ALIAS).filter(**tag_filter).delete()


def noop(*args, **kwargs):
    pass


class Migration(migrations.Migration):

    atomic = False

    dependencies = [
        ('long_running_migrations', '0029_restart_failed_lrm_0024'),
    ]

    operations = [
        migrations.RunPython(reprocess_failed_xforms, noop),
    ]
