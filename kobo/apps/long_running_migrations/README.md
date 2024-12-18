# Long Running Migrations

This feature allows you to execute long-running tasks using Celery. Each task will attempt to complete within a 23-hour window, after which it will give up and retry until it either raises an exception or successfully completes.

## How to Use

1. **Create your migration**
   Define your migrations in the `jobs` folder. Each migration should have a unique name, following Django's migration naming convention (e.g., `0001_description`). The migration file must contain a function called `run()`.

2. **Register the migration**
   Create a `LongRunningMigration` entry by running:

   ```python
   LongRunningMigration.objects.create(task_name='0001_description')
   ```

   You can automate this step by adding it to a Django migration with `RunPython`


3. **Execute the migration**
    Wait for the periodic task `execute_long_running_migrations` to run automatically or trigger it manually (beware of the lock, it can only run one at a time).


## Writing a good task

When writing slow tasks, ensure they are both **atomic** and **tolerant** to interruptions at any point in their execution.

```python
# 2024-10-13
from django.db import transaction

def task():
    for foo in Foo.objects.filter(is_barred=False):  # Checks actually needs to run still
        with transaction.atomic():  # Atomic!
            foo.make_it_bar()  # Perhaps this does multiple things that could succeed or fail
```

* Notice that if the task is interrupted, it will simply continue in the next run.

* Because tasks are slow, your code should run regardless of when the data migration takes place.

* Add a timestamp to your migration definition to help future developers identify when it can be safely removed (if needed).
