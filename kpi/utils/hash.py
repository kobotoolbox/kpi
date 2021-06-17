# coding: utf-8
import hashlib


def get_hash(hashable, algorithm='md5'):

    supported_algorithm = ['md5', 'sha1']
    if algorithm not in supported_algorithm:
        raise NotImplementedError('Only `{algorithms}` are supported'.format(
            algorithms=', '.join(supported_algorithm)
        ))

    if algorithm == 'md5':
        hashlib_def = hashlib.md5
    else:
        hashlib_def = hashlib.sha1

    if isinstance(hashable, str):
        hashable = hashable.encode()

    return hashlib_def(hashable).hexdigest()
