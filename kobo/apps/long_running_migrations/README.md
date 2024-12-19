# Long Running Migrations

This feature allows you to execute long-running migrations using Celery. Each migration will attempt to complete within the maximum time allowed by Celery (see settings.CELERY_LONG_RUNNING_TASK_TIME_LIMIT`). If it does not complete within this time, the periodic task will retry and resume the migration from where it left off, continuing until the long-running migration either successfully completes or raises an exception.

## How to Use

1. **Create your migration**
   Define your migrations in the `jobs` folder. Each migration should have a unique name, following Django's migration naming convention (e.g., `0001_description`). The migration file must contain a function called `run()`.

2. **Register the migration**
   Create a `LongRunningMigration` entry by running:

   ```python
   LongRunningMigration.objects.create(name='0001_sample')
   ```

   You can automate this step by adding it to a Django migration with `RunPython`.
   
   ```python
    from django.db import migrations
    
    
    def add_long_running_migration(apps, schema_editor):
        LongRunningMigration = apps.get_model('long_running_migrations', 'LongRunningMigration')  # noqa
        LongRunningMigration.objects.create(
            name='0001_sample'
        )
    
    
    def noop(*args, **kwargs):
        pass
    
    
    class Migration(migrations.Migration):
    
        dependencies = [
            ('long_running_migrations', '0001_initial'),
        ]
    
        operations = [
            migrations.RunPython(add_long_running_migration, noop),
        ]
    
    
    ```



3. **Execute the migration**
    Wait for the periodic task `execute_long_running_migrations` to run automatically or trigger it manually (beware of the lock, it can only run one at a time).


## Writing a good long-running migration

When writing long-running migrations, ensure they are both **atomic** and **tolerant** to interruptions at any point in their execution.

```python
# 2024-10-13
from django.db import transaction

def run():
    for foo in Foo.objects.filter(is_barred=False):  # Checks actually needs to run still
        with transaction.atomic():  # Atomic!
            foo.make_it_bar()  # Perhaps this does multiple things that could succeed or fail
```

* Notice that if the task is interrupted, it will simply continue in the next run.

* Because tasks are slow, your code should run regardless of when the data migration takes place.

* Add a timestamp to your migration definition to help future developers identify when it can be safely removed (if needed).
