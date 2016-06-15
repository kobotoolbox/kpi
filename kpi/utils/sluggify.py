# coding: utf-8

from __future__ import (unicode_literals, print_function,
                        absolute_import, division)
import re

DEFAULT_OPTS = {
    'lrstrip': False,
    'lstrip': False,
    'rstrip': False,
    'descriptor': "slug",
    'lowerCase': True,
    'replaceNonWordCharacters': True,
    'nonWordCharsExceptions': False,
    'preventDuplicateUnderscores': False,
    'validXmlTag': False,
    'underscores': True,
    'characterLimit': 30,
    'preventDuplicates': False,
    'incrementorPadding': False,
}


def sluggify(_str, _opts):
    if _str == '':
        return ''
    opts = DEFAULT_OPTS.copy()
    opts.update(_opts)

    if opts['lrstrip']:
        _str = _str.strip()
    elif opts['lstrip']:
        _str = _str.lstrip()
    elif opts['rstrip']:
        _str = _str.rstrip()

    if opts['lowerCase']:
        _str = _str.lower()

    if opts['underscores']:
        _str = re.sub('\s', '_', _str)
        # .replace(/[_]+/g, "_") <- replaces duplicates?

    if opts['replaceNonWordCharacters']:
        if opts['nonWordCharsExceptions']:
            regex = '\W^[%s]' % opts['nonWordCharsExceptions']
        else:
            regex = '\W+'
        _str = re.sub(regex, '_', _str)
        if re.search('_$', _str):
            _str = re.sub('_$', '', _str)

    if opts['characterLimit']:
        _limit = opts['characterLimit']
        _str = _str[0:_limit]

    if opts['validXmlTag']:
        if re.search('^\d', _str):
            _str = '_' + _str

    if opts['preventDuplicateUnderscores']:
        while re.search('__', _str):
            _str = re.sub('__', '_', _str)

    names = opts['preventDuplicates']
    if isinstance(names, list):
        names_lc = [name.lower() for name in names]
        attempt_base = _str
        if len(attempt_base) == 0:
            raise ValueError("Renaming Error: {} is empty"
                             .format(opts['descriptor']))
        attempt = attempt_base
        incremented = 0
        while attempt.lower() in names_lc:
            incremented += 1
            attempt = "{0}_{1:03d}".format(attempt_base, incremented)
        _str = attempt

    return _str


def sluggify_label(label, other_names=[]):
    return sluggify(label, {
                'preventDuplicates': other_names,
                'lowerCase': False,
                'preventDuplicateUnderscores': True,
                'stripSpaces': True,
                'lrstrip': True,
                'incrementorPadding': 3,
                'validXmlTag': True,
            })
