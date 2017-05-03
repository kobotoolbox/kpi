import requests
import os
from cStringIO import StringIO
from PIL import Image

from django.conf import settings
from django.core.files.storage import get_storage_class
from django.core.files.base import ContentFile

from tempfile import NamedTemporaryFile


def get_path(path, suffix):
    fileName, fileExtension = os.path.splitext(path)
    return fileName + suffix + fileExtension

def flat(*nums):
    '''Build a tuple of ints from float or integer arguments.
    Useful because PIL crop and resize require integer points.
    source: https://gist.github.com/16a01455
    '''

    return tuple(int(round(n)) for n in nums)


def get_dimensions((width, height), longest_side):
    if width > height:
        width = longest_side
        height = (height / width) * longest_side
    elif height > width:
        height = longest_side
        width = (width / height) * longest_side
    else:
        height = longest_side
        width = longest_side
    return flat(width, height)


def _save_thumbnails(image, path, size, suffix):
    nm = NamedTemporaryFile(suffix='.%s' % settings.IMG_FILE_TYPE)
    default_storage = get_storage_class()()
    try:
        # Ensure conversion to float in operations
        image.thumbnail(
            get_dimensions(image.size, float(size)), Image.ANTIALIAS)
    except ZeroDivisionError:
        pass
    try:
        image.save(nm.name)
    except IOError:
        # e.g. `IOError: cannot write mode P as JPEG`, which gets raised when
        # someone uploads an image in an indexed-color format like GIF
        image.convert('RGB').save(nm.name)
    default_storage.save(
        get_path(path, suffix), ContentFile(nm.read()))
    nm.close()


def resize(filename):
    default_storage = get_storage_class()()
    path = default_storage.url(filename)
    req = requests.get(path)
    if req.status_code == 200:
        im = StringIO(req.content)
        image = Image.open(im)
        conf = settings.THUMB_CONF
        [_save_thumbnails(
            image, filename,
            conf[key]['size'],
            conf[key]['suffix']) for key in settings.THUMB_ORDER]


def resize_local_env(filename, fs=None):
    default_storage = fs if fs else get_storage_class()()
    path = default_storage.path(filename)
    image = Image.open(path)
    conf = settings.THUMB_CONF

    [_save_thumbnails(
        image, path, conf[key]['size'],
        conf[key]['suffix']) for key in settings.THUMB_ORDER]


def image_url(attachment, suffix):
    '''Return url of an image given size(@param suffix)
    e.g large, medium, small, or generate required thumbnail
    '''
    url = attachment.media_file.url
    default_storage = get_storage_class()()
    fs = get_storage_class('django.core.files.storage.FileSystemStorage')()
    filename = attachment.media_file.name
    if suffix == 'original':
        if default_storage.exists(filename):
            return url
        elif default_storage.__class__ != fs.__class__ and fs.exists(filename):
            return fs.url(filename)
        elif settings.KOBOCAT_URL:
            url = settings.KOBOCAT_URL.strip("/") + settings.MEDIA_URL + attachment.media_file.name
            req = requests.get(url)
            if req.status_code == 200:
                return url
            else:
                url = settings.KOBOCAT_URL.strip("/") + "/attachment/" + suffix + "?media_file=" + filename
                req = requests.get(url)
                if req.status_code == 302:
                    return req.url
                return url
        else:
            return None
    else:
        if suffix in settings.THUMB_CONF:
            size = settings.THUMB_CONF[suffix]['suffix']
            if default_storage.exists(filename):
                if default_storage.exists(get_path(filename, size)) and\
                        default_storage.size(get_path(filename, size)) > 0:
                    url = default_storage.url(
                        get_path(filename, size))

                else:
                    if default_storage.__class__ != fs.__class__:
                        resize(filename)
                    else:
                        resize_local_env(filename)
                    return image_url(attachment, suffix)
            elif default_storage.__class__ != fs.__class__ and fs.exists(filename):
                # Fallback to local storage if default storage is AWS
                if fs.exists(get_path(filename, size)) and \
                        fs.size(get_path(filename, size)) > 0:
                    url = fs.url(
                        get_path(filename, size))
                else:
                    resize_local_env(filename, fs)
                    return image_url(attachment, suffix)
            elif settings.KOBOCAT_URL:
                # Fallback to Kobocat location if not stored in s3 (if KC location exists)
                filename = url.split('/')[-1]
                url = settings.KOBOCAT_URL.strip("/") + settings.MEDIA_URL + attachment.media_file.name
                url.replace(filename, get_path(filename, size))
                req = requests.get(url)
                if req.status_code == 200:
                    return url
                else:
                    media_file = attachment.media_file.name
                    url = settings.KOBOCAT_URL.strip("/") + "/attachment/" + suffix + "?media_file=" + media_file
                    req = requests.get(url)
                    if req.status_code == 302:
                        return req.url
                    return url
            else:
                return None
    return url
