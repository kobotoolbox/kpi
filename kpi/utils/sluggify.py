# coding: utf-8
import xml.etree.ElementTree as ET
import re

from kpi.utils.hash import calculate_hash

# an approximation of the max size.
# actual max length will be 40 + len(join_with) + len("_001")
MAX_NAME_LENGTH = 40

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
    'characterLimit': False,
    'characterLimit_shorten_method': 'ends',
    '_is_duplicate': False,
    'preventDuplicates': False,
    'incrementorPadding': False,
}


def sluggify(_str, _opts):
    """
    this method is ported over from coffeescript:
    jsapp/xlform/src/model.utils.coffee
    """
    _initial = _str
    if _str == '':
        return ''
    opts = dict(DEFAULT_OPTS, **_opts)

    if opts['lrstrip']:
        _str = _str.strip()
    elif opts['lstrip']:
        _str = _str.lstrip()
    elif opts['rstrip']:
        _str = _str.rstrip()

    if opts['lowerCase']:
        _str = _str.lower()

    if opts['underscores']:
        _str = re.sub(r'\s', '_', _str)
        # .replace(/[_]+/g, "_") <- replaces duplicates?

    if opts['replaceNonWordCharacters']:
        if opts['nonWordCharsExceptions']:
            regex = r'[^a-zA-Z0-9_{}]'.format(opts['nonWordCharsExceptions'])
        else:
            regex = r'[^a-zA-Z0-9_]+'  # Cannot use `\W`. Different behaviour with Python 2 & 3

        _str = re.sub(regex, '_', _str)
        if _str != '_' and re.search('_$', _str):
            _str = re.sub('_$', '', _str)

    if opts['characterLimit']:
        _limit = opts['characterLimit']
        if opts['characterLimit_shorten_method'] == 'ends':
            _str = _shorten_long_name(_str, _limit, join_with='_')
        else:
            _str = _str[0:opts['characterLimit']]

    if opts['validXmlTag']:
        if re.search(r'^\d', _str):
            _str = '_' + _str

    if opts['preventDuplicateUnderscores']:
        while re.search('__', _str):
            _str = re.sub('__', '_', _str)

    names = opts.get('other_names', opts['preventDuplicates'])
    if isinstance(names, list):
        names_lc = [name.lower() for name in names]
        attempt_base = _str
        if len(attempt_base) == 0:
            # empty string because arabic / cyrillic characters
            _str = 'h{}'.format(calculate_hash(_initial[0:7])[0:7])
        attempt = attempt_base
        incremented = 0
        while attempt.lower() in names_lc:
            incremented += 1
            attempt = "{0}_{1:03d}".format(attempt_base, incremented)
        _str = attempt

    return _str


def sluggify_label(label, **opts):
    return sluggify(label, dict({
                'lowerCase': False,
                'preventDuplicateUnderscores': True,
                'stripSpaces': True,
                'lrstrip': True,
                'incrementorPadding': 3,
                'validXmlTag': True,
           }, **opts))


def is_valid_node_name(_name):
    if not isinstance(_name, str):
        return False
    if _name == '':
        return False
    try:
        ET.fromstring('<{} />'.format(_name))
        return True
    except Exception:
        return False


def _shorten_long_name(name, character_limit, join_with):
    """
    This takes the beginning and the ending of the string and concatenates it to
    meet the length requirements.
    Example:
        "beginning_of_the_" + "_end_of_the_long_question"
    """
    if len(name) > character_limit:
        _half_length = int(character_limit / 2)
        _last_half_start_n = len(name) - _half_length
        first_half = name[0:_half_length]
        second_half = name[_last_half_start_n:]
        name = ''.join([first_half,
                        join_with,
                        second_half])
    return name
