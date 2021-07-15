# coding: utf-8
# 😬
import copy

from django.contrib.postgres.fields import JSONField as JSONBField
from django.db import models
from rest_framework.reverse import reverse

from formpack import FormPack

from kpi.fields import KpiUidField
from kpi.interfaces.open_rosa import OpenRosaFormListInterface
from kpi.mixins import (
    FormpackXLSFormUtilsMixin,
    XlsExportableMixin,
)
from kpi.utils.hash import calculate_hash
from kpi.utils.log import logging
from kpi.utils.models import DjangoModelABCMetaclass


class AbstractFormList(
    OpenRosaFormListInterface, metaclass=DjangoModelABCMetaclass
):
    """
    The only purpose of this class is to make `./manage.py migrate` pass.
    Unfortunately, `AssetSnapshot` cannot inherit directly from `OpenRosaFormListInterface`,
    i.e.,
    ```
        AssetSnapshot(
            models.Model,
            OpenRosaFormListInterface,
            metaclass=DjangoModelABCMetaclass,
        )
    ```
    because Django calls internally `type('model_name', model.__bases__, ...)`
    ignoring the specified meta class of the model. This makes a meta class
    conflict between the "base" classes which use meta classes too, e.g.,
    `django.db.models.base.ModelBase` and `abc.ABC`

    > TypeError: metaclass conflict: the metaclass of a derived class must be
    > a (non-strict) subclass of the metaclasses of all its bases

    """
    pass


class AssetSnapshot(
    models.Model,
    AbstractFormList,
    XlsExportableMixin,
    FormpackXLSFormUtilsMixin,
):
    """
    This model serves as a cache of the XML that was exported by the installed
    version of pyxform.

    TODO: come up with a policy to clear this cache out.
    DO NOT: depend on these snapshots existing for more than a day
    until a policy is set.
    Done with https://github.com/kobotoolbox/kpi/pull/2434.
    Remove above lines when PR is merged
    """
    xml = models.TextField()
    source = JSONBField(default=dict)
    details = JSONBField(default=dict)
    owner = models.ForeignKey('auth.User', related_name='asset_snapshots',
                              null=True, on_delete=models.CASCADE)
    asset = models.ForeignKey('Asset', null=True, on_delete=models.CASCADE)
    _reversion_version_id = models.IntegerField(null=True)
    asset_version = models.OneToOneField('AssetVersion',
                                         on_delete=models.CASCADE,
                                         null=True)
    date_created = models.DateTimeField(auto_now_add=True)
    uid = KpiUidField(uid_prefix='s')

    @property
    def content(self):
        return self.source

    @property
    def description(self):
        """
        Implements `OpenRosaFormListInterface.description`
        """
        return self.asset.settings.get('description', '')

    @property
    def form_id(self):
        """
        Implements `OpenRosaFormListInterface.form_id()`
        """
        return self.uid

    def get_download_url(self, request):
        """
        Implements `OpenRosaFormListInterface.get_download_url()`
        """
        return reverse(
            viewname='assetsnapshot-detail',
            format='xml',
            kwargs={'uid': self.uid},
            request=request
        )

    def get_manifest_url(self, request):
        """
        Implements `OpenRosaFormListInterface.get_manifest_url()`
        """
        return reverse(
            viewname='assetsnapshot-manifest',
            format='xml',
            kwargs={'uid': self.uid},
            request=request
        )

    @property
    def md5_hash(self):
        """
        Implements `OpenRosaFormListInterface.md5_hash()`
        """
        return f'{calculate_hash(self.xml, prefix=True)}'

    @property
    def name(self):
        """
        Implements `OpenRosaFormListInterface.name()`
        """
        return self.asset.name

    def save(self, *args, **kwargs):
        if self.asset is not None:
            # Previously, `self.source` was a nullable field. It must now
            # either contain valid content or be an empty dictionary.
            assert self.asset is not None
            if not self.source:
                if self.asset_version is None:
                    self.asset_version = self.asset.latest_version
                self.source = self.asset_version.version_content
            if self.owner is None:
                self.owner = self.asset.owner
        _note = self.details.pop('note', None)
        _source = copy.deepcopy(self.source)
        self._standardize(_source)
        self._make_default_translation_first(_source)
        self._strip_empty_rows(_source)
        self._autoname(_source)
        self._remove_empty_expressions(_source)
        _settings = _source.get('settings', {})
        form_title = _settings.get('form_title')
        id_string = _settings.get('id_string')

        self.xml, self.details = \
            self.generate_xml_from_source(_source,
                                          include_note=_note,
                                          root_node_name='data',
                                          form_title=form_title,
                                          id_string=id_string)
        self.source = _source
        return super().save(*args, **kwargs)

    def generate_xml_from_source(self,
                                 source,
                                 include_note=False,
                                 root_node_name='snapshot_xml',
                                 form_title=None,
                                 id_string=None):
        if form_title is None:
            form_title = 'Snapshot XML'
        if id_string is None:
            id_string = 'snapshot_xml'

        if include_note and 'survey' in source:
            _translations = source.get('translations', [])
            _label = include_note
            if len(_translations) > 0:
                _label = [_label for t in _translations]
            source['survey'].append({'type': 'note',
                                     'name': 'prepended_note',
                                     'label': _label})

        source_copy = copy.deepcopy(source)
        self._expand_kobo_qs(source_copy)
        self._populate_fields_with_autofields(source_copy)
        self._strip_kuids(source_copy)

        warnings = []
        details = {}
        try:
            xml = FormPack({'content': source_copy},
                           root_node_name=root_node_name,
                           id_string=id_string,
                           title=form_title)[0].to_xml(warnings=warnings)

            details.update({
                'status': 'success',
                'warnings': warnings,
            })
        except Exception as err:
            err_message = str(err)
            logging.error('Failed to generate xform for asset', extra={
                'src': source,
                'id_string': id_string,
                'uid': self.uid,
                '_msg': err_message,
                'warnings': warnings,
            })
            xml = ''
            details.update({
                'status': 'failure',
                'error_type': type(err).__name__,
                'error': err_message,
                'warnings': warnings,
            })
        return xml, details
