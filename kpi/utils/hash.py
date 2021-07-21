# coding: utf-8
import hashlib
from typing import Union, BinaryIO, Optional

import requests


def calculate_hash(
    source: Union[str, bytes, BinaryIO],
    algorithm: str = 'md5',
    prefix: bool = False,
) -> str:
    """
    Calculates the hash for `source`. Supported algorithm are `md5` and `sha1`.
    The returned string is prefixed with `algorithm` if `prefix` is `True`.
    If `source` is a file, it must be opened in binary mode.
    If `source` is a URL, headers are used to build the hash in this order.
    - `ETag`
    - `Last-Modified`
    - `Content-Length`
    If none of them work, it falls back to the URL itself. Moreover, the hash is
    suffixed with a keyword related to the detected header.
    For example:
        - `ETag` => `aaaa1111111-etag`
        - `Last-Modified` => `aaaa1111111-last-modified`
        - `Content-Length` => `aaaa1111111-length`

        - `none` => `aaaa1111111-url`

    """

    hashlib_def = getattr(hashlib, algorithm, None)
    if not hashlib_def:
        raise NotImplementedError('`{algorithm}` is not supported')

    def _finalize_hash(
        hashable_: Union[str, bytes], suffix: Optional[str] = None
    ) -> str:
        """
        Return final string with/without the algorithm as prefix and specified
        suffix if any
        """
        if isinstance(hashable_, str):
            hashable_ = hashable_.encode()

        hash_ = hashlib_def(hashable_).hexdigest()

        if prefix:
            hash_ = f'{algorithm}:{hash_}'

        if suffix:
            hash_ = f'{hash_}-{suffix}'

        return hash_

    if not isinstance(source, str):
        try:
            source = source.read()
        except AttributeError:
            # Source is `bytes`, just return its hash
            pass

        return _finalize_hash(source)

    # If `source` is a string, it can be a URL or real string
    if not source.startswith('http'):
        return _finalize_hash(source)

    # Ensure we do not receive a gzip response to be able to read headers such
    # as `Content-Length`
    headers = {'Accept-Encoding': 'identity'}
    try:
        response = requests.head(source, headers=headers)
        response.raise_for_status()
    except requests.exceptions.RequestException as e:
        return _finalize_hash(source, 'url')

    try:
        content_type = response.headers['Content-Type']
    except KeyError:
        return _finalize_hash(source, 'url')

    try:
        etag = response.headers['ETag']
    except KeyError:
        pass
    else:
        return _finalize_hash(f'{content_type}:{etag}', 'etag')

    try:
        last_modified = response.headers['Last-Modified']
    except KeyError:
        pass
    else:
        return _finalize_hash(f'{content_type}:{last_modified}', 'last-modified')

    try:
        content_length = response.headers['Content-Length']
    except KeyError:
        pass
    else:
        return _finalize_hash(f'{content_type}:{content_length}', 'length')

    return _finalize_hash(source, 'url')


