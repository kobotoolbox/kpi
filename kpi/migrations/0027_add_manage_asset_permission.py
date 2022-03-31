from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('kpi', '0026_disable_editors_can_change_permissions'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='asset',
            options={
                'default_permissions': ('add', 'change', 'delete'),
                'ordering': ('-date_modified',),
                'permissions': (
                    ('view_asset', 'Can view asset'),
                    ('manage_asset', 'Can manage all aspects of asset'),
                    ('add_submissions', 'Can submit data to asset'),
                    ('view_submissions', 'Can view submitted data for asset'),
                    (
                        'partial_submissions',
                        'Can make partial actions on submitted data for asset for specific users',
                    ),
                    (
                        'change_submissions',
                        'Can modify submitted data for asset',
                    ),
                    (
                        'delete_submissions',
                        'Can delete submitted data for asset',
                    ),
                    (
                        'validate_submissions',
                        'Can validate submitted data asset',
                    ),
                    ('from_kc_only', 'INTERNAL USE ONLY; DO NOT ASSIGN'),
                ),
            },
        ),
        migrations.AlterModelOptions(
            name='collection',
            options={
                'default_permissions': ('add', 'change', 'delete'),
                'ordering': ('-date_modified',),
                'permissions': (('view_collection', 'Can view collection'),),
            },
        ),
        migrations.RemoveField(
            model_name='asset',
            name='editors_can_change_permissions',
        ),
        migrations.RemoveField(
            model_name='collection',
            name='editors_can_change_permissions',
        ),
    ]
