# coding: utf-8
import os

import django
from django.conf import settings
from django.core.handlers.wsgi import WSGIHandler
from django.db import connections


os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kobo.apps.openrosa.settings.prod')

django.setup(set_prefix=False)

# Close DB connections to avoid deadlock when uwsgi forks process.
# see https://github.com/unbit/uwsgi/issues/1599#issuecomment-336584282

# Close PostgreSQL connections
for conn in connections.all():
    conn.close()

# Close MongoDB connections if MongoClient has been instantiated already.
if hasattr(settings, 'mongo_client'):
    settings.mongo_client.close()

application = WSGIHandler()
