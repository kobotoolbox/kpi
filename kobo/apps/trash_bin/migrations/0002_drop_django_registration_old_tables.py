# Generated by Django 3.2.15 on 2023-03-02 14:55

from django.db import migrations


def delete_if_exists(table_name):
    """
    Delete old record from the table if table exists.
    Avoid DROP SQL statement to fail because of constraints if table still
    contains data
    """
    return f"""
    DO $$
    BEGIN
        IF EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = '{table_name}') THEN
            DELETE FROM {table_name};
        END IF;
    END; $$;
    """


class Migration(migrations.Migration):

    dependencies = [
        ('trash_bin', '0001_initial'),
    ]

    operations = [
        migrations.RunSQL(
            sql=(
                delete_if_exists('registration_supervisedregistrationprofile')
                + 'DROP TABLE IF EXISTS registration_supervisedregistrationprofile CASCADE;'
            ),
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.RunSQL(
            sql=(
                delete_if_exists('registration_registrationprofile')
                + 'DROP TABLE IF EXISTS registration_registrationprofile CASCADE;'
            ),
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
