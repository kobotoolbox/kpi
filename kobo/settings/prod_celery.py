# flake8: noqa: F405, F403
from .prod import *

# Add specific VARIABLES for production environment here
# So far, all values are declared in `base.py`

ENV = 'prod'

for database in DATABASES.values():
    if database.get('ENGINE', '').startswith('django.db.backends.postgr'):
        options = database.setdefault('OPTIONS', {})
        options['options'] = f'-c statement_timeout={DATABASE_CELERY_QUERY_TIMEOUT}'
