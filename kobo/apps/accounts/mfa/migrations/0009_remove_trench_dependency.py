from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('accounts_mfa', '0008_alter_mfamethodswrapper_options_and_more'),
    ]

    operations = [
        migrations.DeleteModel(name='MfaMethod'),
        migrations.RunSQL(
            sql=(
                'DROP TABLE IF EXISTS accounts_mfa_mfamethod CASCADE;'
                'DROP TABLE IF EXISTS trench_mfamethod CASCADE;'
            ),
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
