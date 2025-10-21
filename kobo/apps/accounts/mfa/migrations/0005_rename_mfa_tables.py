from django.conf import settings
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('mfa', '0003_authenticator_type_uniq'),
        ('accounts_mfa', '0001_squashed_0004_alter_mfamethod_date_created_and_more'),
    ]

    operations = [
        migrations.RunSQL(
            sql='ALTER TABLE IF EXISTS mfa_mfaavailabletouser RENAME TO accounts_mfa_mfaavailabletouser;',
            reverse_sql='ALTER TABLE accounts_mfa_mfaavailabletouser RENAME TO mfa_mfaavailabletouser;',
        ),
        migrations.RunSQL(
            sql='ALTER TABLE IF EXISTS mfa_mfamethod RENAME TO accounts_mfa_mfamethod;',
            reverse_sql='ALTER TABLE accounts_mfa_mfamethod RENAME TO mfa_mfamethod;',
        ),
    ]
