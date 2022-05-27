import csv
import sys
import time

from django.contrib.auth.models import User
from django.db.models import CharField, F, Count
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
    'asset_count',
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
    'phone_number',
    'primarySector',
    'address',
    'default_language',
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
            asset_count=Count('assets'),
        )
        .values(*values)
        .order_by('id')
    )


def flatten_metadata_inplace(metadata):
    for k, v in metadata.items():
        if isinstance(v, list):
            v = v[0] if v else ''
        if isinstance(v, dict) and 'value' in v:
            metadata[k] = v['value']


def write_csv(filename, data, total_count):
    with open(filename, 'w') as f:
        columns = USER_COLS + EXTRA_DETAILS_COLS
        writer = csv.DictWriter(f, fieldnames=columns)
        writer.writeheader()
        for i, item in enumerate(data):
            metadata = item.pop('metadata', {}) or dict()
            flatten_metadata_inplace(metadata)
            item.update(metadata)
            writer.writerow(item)
            print(
                f'Progress:\t{i+1}/{total_count}\t{((i+1)*100)//total_count}%',
                end='\r',
            )
        print()


def run(*args):
    if not args:
        print('Inlcude filename and path in `--script-args`')
        sys.exit()
    filename = args[0]
    t0 = time.time()
    data = get_user_data()
    total_count = data.count()
    write_csv(filename, data, total_count)
    t1 = time.time()
    print(f'Completed {total_count} users in {t1-t0:.4f}s.')
