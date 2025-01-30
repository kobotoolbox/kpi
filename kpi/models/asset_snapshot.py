# coding: utf-8
# 😬
import copy

from django.conf import settings
from django.db import models
from formpack import FormPack
from rest_framework.reverse import reverse


from kpi.fields import KpiUidField
from kpi.interfaces.open_rosa import OpenRosaFormListInterface
from kpi.mixins import (
    FormpackXLSFormUtilsMixin,
    XlsExportableMixin,
)
from kpi.utils.hash import calculate_hash
from kpi.utils.log import logging
from kpi.utils.models import DjangoModelABCMetaclass
from kpi.utils.pyxform_compatibility import allow_choice_duplicates


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
    """
    xml = models.TextField()
    source = models.JSONField(default=dict)
    details = models.JSONField(default=dict)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='asset_snapshots',
                              null=True, on_delete=models.CASCADE)
    asset = models.ForeignKey('Asset', null=True, on_delete=models.CASCADE)
    # FIXME: uuid on the KoboCAT logger.Instance model has max_length 249
    submission_uuid = models.CharField(null=True, max_length=41)
    _reversion_version_id = models.IntegerField(null=True)
    asset_version = models.ForeignKey(
        'AssetVersion', on_delete=models.CASCADE, null=True
    )
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
            viewname='assetsnapshot-xml-with-disclaimer',
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
        # TODO: move these inside `generate_xml_from_source()`?
        _settings = _source.get('settings', {})
        form_title = _settings.get('form_title')
        id_string = _settings.get('id_string')
        root_node_name = _settings.get('name')
        self.xml, self.details = self.generate_xml_from_source(
            _source,
            include_note=_note,
            root_node_name=root_node_name,
            form_title=form_title,
            id_string=id_string,
        )
        if self.submission_uuid:
            _xml = self.xml
            rootUuid = self.submission_uuid.replace('uuid:', '')
            # this code would fit best within "generate_xml_from_source" method, where
            # additional XForm attributes are passed to formpack / pyxform at generation,
            # but the equivalent change can be done with string replacement
            instance_id_path = f'/{id_string}/meta/instanceID'
            after_instanceid = '<rootUuid/>'
            before_modelclose = '<bind calculate="\'' + rootUuid + '\'" ' + \
                f'nodeset="/{id_string}/meta/rootUuid" ' + \
                'required="true()" type="string"/>'

            _xml = _xml.replace('<instanceID/>', f'<instanceID/>\n{after_instanceid}')
            _xml = _xml.replace('</model>', f'{before_modelclose}\n</model>')
            self.xml = _xml

        self.source = _source
        return super().save(*args, **kwargs)

    def generate_xml_from_source(self,
                                 source,
                                 include_note=False,
                                 root_node_name=None,
                                 form_title=None,
                                 id_string=None):

        if not root_node_name:
            if self.asset and self.asset.uid:
                root_node_name = self.asset.uid
            else:
                root_node_name = 'snapshot_xml'

        if not form_title:
            if self.asset and self.asset.name:
                form_title = self.asset.name
            else:
                form_title = 'Snapshot XML'

        if id_string is None:
            id_string = root_node_name

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
        self._strip_dollar_fields(source_copy)

        allow_choice_duplicates(source_copy)

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

    @property
    def xform_root_node_name(self):
        """
        Retrieves the name of the XML tag representing the root node of the "survey"
        in the XForm XML structure.

        This method uses the `name` setting from the XLSForm to determine the tag name.
        If no name is provided, it falls back to using the asset UID.
        """

        try:
            return self.asset.content['settings']['name']
        except KeyError:
            return self.asset.uid
