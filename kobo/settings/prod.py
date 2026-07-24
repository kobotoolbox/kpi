# flake8: noqa: F405, F403
from .base import *

# Add specific VARIABLES for production environment here
# So far, all values are declared in `base.py`

ENV = 'prod'

for database in DATABASES.values():
    if any(s in database.get('ENGINE', '') for s in ['postgis', 'postgres']):
        options = database.setdefault('OPTIONS', {})
        options['options'] = f'-c statement_timeout={DATABASE_QUERY_TIMEOUT}'
