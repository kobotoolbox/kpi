from django.conf import settings
from django.db import migrations


class StateOnlyAlterUniqueTogether(migrations.AlterUniqueTogether):
    """
    The omission of `AlterUniqueTogether` in `0017_remove_xform_sms.py`
    meant that the `XForm` model in Django's versioned app registry
    continued to have:

        unique_together = {('user', 'sms_id_string'), ('user', 'id_string')}

    …which caused `./manage.py makemigrations` to add an `AlterUniqueTogether`
    operation. That operation, in turn, failed with:

        django.core.exceptions.FieldDoesNotExist: XForm has no field named 'sms_id_string'

    This custom migation operation updates the versioned app registry but makes
    no changes to the database. See
    https://docs.djangoproject.com/en/2.2/ref/migration-operations/#writing-your-own
    """

    reduces_to_sql = False
    reversible = True

    # We do not override state_forwards() from the base class; it performs
    # the needed updates to the versioned app registry

    def database_forwards(self, *args, **kwargs):
        pass

    def database_backwards(self, *args, **kwargs):
        pass

    def describe(self):
        # This is used to describe what the operation does in console output.
        return '[state only] ' + super().describe()


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('logger', '0020_submission_counter_timestamp_as_date'),
    ]

    operations = [
        StateOnlyAlterUniqueTogether(
            name='xform',
            unique_together={('user', 'id_string')},
        ),
    ]
