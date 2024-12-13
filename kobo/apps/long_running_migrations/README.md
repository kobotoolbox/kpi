# Long Running Migrations

This will execute a task in celery. The task will try for 23 hours and then give up. It will retry until it yields an exception or completes.

1. Create your tasks in tasks and give it a unique name. Django migration style 0001_description is a good idea. It must contain a function called "task".
2. Run `LongRunningMigration.objects.create(task_name="0001_description")`. Consider running this from a real Django migration.
3. Wait for daily maintenance task or manually dispatch the celery "perform_maintenance".

## Writing a good task.

Very slow tasks should be written atomically and tolerant to disruption at any time.

```python
# 2024-10-13
from django.db import transaction

def task():
    for foo in Foo.objects.filter(is_barred=False):  # Checks actually needs to run still
        with transaction.atomic():  # Atomic!
            foo.make_it_bar()  # Perhap this does multiple things that could succeed or fail
```

Notice that if the task is interrupted, it will simply continue in the next run.

Because tasks are slow, your code should run regardless of when the data migration takes place.

Timestamp the task to help a future developer know when it can be safely deleted.
