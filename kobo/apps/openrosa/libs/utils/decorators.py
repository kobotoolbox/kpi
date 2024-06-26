# coding: utf-8
from functools import wraps

from kobo.apps.openrosa.apps.logger.models import XForm


def check_obj(f):
    @wraps(f)
    def with_check_obj(*args, **kwargs):
        if args[0]:
            return f(*args, **kwargs)

    return with_check_obj


def apply_form_field_names(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        def _get_decoded_record(record):
            if isinstance(record, dict):
                # Avoid RuntimeError: dictionary keys changed during iteration
                record_iter = dict(record)
                for field in record_iter:
                    if isinstance(record[field], list):
                        tmp_items = []
                        items = record[field]
                        for item in items:
                            tmp_items.append(_get_decoded_record(item))
                        record[field] = tmp_items
                    if field not in field_names.values() and \
                            field in field_names.keys():
                        record[field_names[field]] = record.pop(field)
            return record

        cursor = func(*args, **kwargs)
        # Compare by class name instead of type because tests use MockMongo
        if cursor.__class__.__name__ == 'Cursor' and 'id_string' in kwargs and \
                'username' in kwargs:
            username = kwargs.get('username')
            id_string = kwargs.get('id_string')
            dd = XForm.objects.get(
                id_string=id_string, user__username=username)
            records = []
            field_names = dd.data_dictionary().get_mongo_field_names_dict()
            for record in cursor:
                records.append(_get_decoded_record(record))
            return records
        return cursor
    return wrapper
