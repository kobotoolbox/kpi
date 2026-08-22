from django.db import migrations, models
from django.db.models import Func, Value
from django.db.models.functions import Lower


class Migration(migrations.Migration):

    dependencies = [
        ('kobo_auth', '0001_initial'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='user',
            index=models.Index(
                Func(
                    Lower('email'),
                    Value('@'),
                    Value(2),
                    function='split_part',
                    output_field=models.CharField(),
                ),
                name='auth_user_email_domain_idx',
            ),
        ),
    ]
