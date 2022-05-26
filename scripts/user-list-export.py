import csv
import sys
import time

from django.contrib.auth.models import User
from django.db.models import CharField, F
from django.db.models.functions import Cast


USER_COLS = [
    'id',
    'username',
    'is_superuser',
    'is_staff',
    'date_joined_str',
    'last_login_str',
    'first_name',
    'last_name',
    'is_active',
    'email',
    'mfa_is_active',
]
METADATA_COL = ['metadata']
EXTRA_DETAILS_COLS = [
    'bio',
    'city',
    'name',
    'gender',
    'sector',
    'country',
    'twitter',
    'linkedin',
    'metadata',
    'instagram',
    'organization',
    'require_auth',
    'organization_website',
]


def get_user_data():
    values = USER_COLS + METADATA_COL
    return (
        User.objects.all()
        .annotate(
            mfa_is_active=F('mfa_methods__is_active'),
            metadata=F('extra_details__data'),
            date_joined_str=Cast('date_joined', CharField()),
            last_login_str=Cast('last_login', CharField()),
        )
        .values(*values)
        .order_by('id')
    )


def flatten_metadata_inplace(metadata):
    for k, v in metadata.items():
        if isinstance(v, list):
            v = v[0]
        if isinstance(v, dict) and 'label' in v:
            metadata[k] = v['label']


def write_csv(filename, data):
    with open(filename, 'w') as f:
        columns = USER_COLS + EXTRA_DETAILS_COLS
        writer = csv.DictWriter(f, fieldnames=columns)
        writer.writeheader()
        for item in data:
            metadata = item.pop('metadata')
            flatten_metadata_inplace(metadata)
            item.update(metadata)
            writer.writerow(item)


def run(*args):
    if not args:
        print('Inlcude filename and path in `--script-args`')
        sys.exit()
    filename = args[0]
    t0 = time.time()
    data = get_user_data()
    write_csv(filename, data)
    t1 = time.time()
    print(f'Completed in {t1-t0:.4f}s.')
