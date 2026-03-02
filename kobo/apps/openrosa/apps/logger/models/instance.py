from hashlib import sha256

from django.apps import apps
from django.contrib.gis.db import models
from django.contrib.gis.geos import GeometryCollection, Point
from django.db.models import UniqueConstraint
from django.utils import timezone
from jsonfield import JSONField
from taggit.managers import TaggableManager

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.exceptions import (
    AccountInactiveError,
    FormInactiveError,
    TemporarilyUnavailableError,
)
from kobo.apps.openrosa.apps.logger.fields import LazyDefaultBooleanField
from kobo.apps.openrosa.apps.logger.models.survey_type import SurveyType
from kobo.apps.openrosa.apps.logger.models.xform import XForm
from kobo.apps.openrosa.apps.logger.xform_instance_parser import (
    XFormInstanceParser,
    clean_and_parse_xml,
    get_root_uuid_from_xml,
    get_uuid_from_xml,
)
from kobo.apps.openrosa.libs.utils.common_tags import (
    ATTACHMENTS,
    GEOLOCATION,
    ID,
    MONGO_STRFTIME,
    NOTES,
    SUBMISSION_TIME,
    SUBMITTED_BY,
    TAGS,
    UUID,
    XFORM_ID_STRING,
)
from kobo.apps.openrosa.libs.utils.model_tools import set_uuid
from kobo.apps.openrosa.libs.utils.viewer_tools import get_mongo_userform_id
from kpi.models.abstract_models import AbstractTimeStampedModel
from kpi.utils.hash import calculate_hash


# need to establish id_string of the xform before we run get_dict since
# we now rely on data dictionary to parse the xml
def get_id_string_from_xml_str(xml_str):
    xml_obj = clean_and_parse_xml(xml_str)
    root_node = xml_obj.documentElement
    id_string = root_node.getAttribute('id')

    if len(id_string) == 0:
        # may be hidden in submission/data/id_string
        elems = root_node.getElementsByTagName('data')

        for data in elems:
            for child in data.childNodes:
                id_string = data.childNodes[0].getAttribute('id')

                if len(id_string) > 0:
                    break

            if len(id_string) > 0:
                break

    return id_string


class Instance(AbstractTimeStampedModel):
    XML_HASH_LENGTH = 64
    DEFAULT_XML_HASH = None

    json = JSONField(default={}, null=False)
    xml = models.TextField()
    xml_hash = models.CharField(
        max_length=XML_HASH_LENGTH,
        db_index=True,
        null=True,
        default=DEFAULT_XML_HASH,
    )
    user = models.ForeignKey(
        User, related_name='instances', null=True, blank=True, on_delete=models.SET_NULL
    )
    xform = models.ForeignKey(
        XForm, null=True, related_name='instances', on_delete=models.CASCADE
    )
    survey_type = models.ForeignKey(SurveyType, on_delete=models.CASCADE)

    # this formerly represented "date instance was deleted".
    # do not use it anymore.
    deleted_at = models.DateTimeField(null=True, default=None)

    root_uuid = models.CharField(max_length=249, null=True, db_index=True)
    # ODK keeps track of three statuses for an instance:
    # incomplete, submitted, complete
    # we add a fourth status: submitted_via_web
    status = models.CharField(max_length=20,
                              default='submitted_via_web')
    uuid = models.CharField(max_length=249, default='', db_index=True)

    # store a geographic objects associated with this instance
    geom = models.GeometryCollectionField(null=True)

    tags = TaggableManager()

    validation_status = JSONField(null=True, default=None)

    # TODO Don't forget to update all records with command `update_is_sync_with_mongo`.
    is_synced_with_mongo = LazyDefaultBooleanField(default=False)

    class Meta:
        app_label = 'logger'
        constraints = [
            UniqueConstraint(
                fields=['root_uuid', 'xform'],
                name='unique_root_uuid_per_xform'
            ),
        ]

    @property
    def asset(self):
        """
        The goal of this property is to make the code future proof.
        We can run the tests on kpi backend or kobocat backend.
        Instance.asset will exist for both
        It's used for validation_statuses.
        :return: XForm
        """
        return self.xform

    def check_active(self, force):
        """Check that form is active and raise exception if not.

        :param force: Ignore restrictions on saving.
        """
        if force:
            return
        if self.xform and not self.xform.downloadable:
            raise FormInactiveError()

        UserProfile = apps.get_model(
            'main', 'UserProfile'
        )  # noqa - Avoid circular imports
        profile, created = UserProfile.objects.get_or_create(user=self.xform.user)
        if not created and profile.submissions_suspended or self.xform.pending_transfer:
            raise TemporarilyUnavailableError()

        if not self.xform.user.is_active:
            raise AccountInactiveError()

    def _get_submitted_by(self):
        try:
            parsed_instance = self.parsed_instance
        except Instance.parsed_instance.RelatedObjectDoesNotExist:
            pass
        else:
            parsed_instance.set_submitted_by(save=True)
            return parsed_instance.submitted_by

        return self.user.username if self.user is not None else None

    def _set_geom(self):
        xform = self.xform
        data_dictionary = xform.data_dictionary()
        geo_xpaths = data_dictionary.geopoint_xpaths()
        doc = self.get_dict()
        points = []

        if len(geo_xpaths):
            for xpath in geo_xpaths:
                geometry = [float(s) for s in doc.get(xpath, '').split()]

                if len(geometry):
                    lat, lng = geometry[0:2]
                    points.append(Point(lng, lat))

            if not xform.instances_with_geopoints and len(points):
                xform.instances_with_geopoints = True
                xform.save()

            self.geom = GeometryCollection(points)

    def _set_json(self):
        doc = self.get_dict()

        if not self.date_created:
            self.date_created = timezone.now()

        point = self.point
        if point:
            doc[GEOLOCATION] = [point.y, point.x]

        doc[SUBMISSION_TIME] = self.date_created.strftime(MONGO_STRFTIME)
        doc[XFORM_ID_STRING] = self._parser.get_xform_id_string()
        doc[SUBMITTED_BY] = self._get_submitted_by()
        self.json = doc

    def _set_parser(self, use_cache: bool = False):
        if not hasattr(self, '_parser'):
            self._parser = XFormInstanceParser(
                self.xml, self.xform.data_dictionary(use_cache)
            )

    def _set_survey_type(self):
        self.survey_type, created = SurveyType.objects.get_or_create(
            slug=self.get_root_node_name()
        )

    def _set_uuid(self):
        if self.xml and not self.uuid:
            uuid = get_uuid_from_xml(self.xml)
            if uuid is not None:
                self.uuid = uuid
        set_uuid(self)

    def _populate_root_uuid(self):
        if self.xml and not self.root_uuid:
            root_uuid, _ = get_root_uuid_from_xml(self.xml)
            assert root_uuid, 'root_uuid should not be empty'
            self.root_uuid = root_uuid

    def _populate_xml_hash(self):
        """
        Populate the `xml_hash` attribute of this `Instance` based on the content of the `xml`
        attribute.
        """
        self.xml_hash = self.get_hash(self.xml)

    @classmethod
    def populate_xml_hashes_for_instances(cls, usernames=None, pk__in=None, repopulate=False):
        """
        Populate the `xml_hash` field for `Instance` instances limited to the specified users
        and/or DB primary keys.

        :param list[str] usernames: Optional list of usernames for whom `Instance`s will be
        populated with hashes.
        :param list[int] pk__in: Optional list of primary keys for `Instance`s that should be
        populated with hashes.
        :param bool repopulate: Optional argument to force repopulation of existing hashes.
        :returns: Total number of `Instance`s updated.
        :rtype: int
        """

        filter_kwargs = dict()
        if usernames:
            filter_kwargs['xform__user__username__in'] = usernames
        if pk__in:
            filter_kwargs['pk__in'] = pk__in
        # By default, skip over instances previously populated with hashes.
        if not repopulate:
            filter_kwargs['xml_hash'] = cls.DEFAULT_XML_HASH

        # Query for the target `Instance`s.
        target_instances_queryset = cls.objects.filter(**filter_kwargs)

        # Exit quickly if there's nothing to do.
        if not target_instances_queryset.exists():
            return 0

        # Limit our queryset result content since we'll only need the `pk` and `xml` attributes.
        target_instances_queryset = target_instances_queryset.only('pk', 'xml')
        instances_updated_total = 0

        # Break the potentially large `target_instances_queryset` into chunks to avoid memory
        # exhaustion.
        chunk_size = 2000
        target_instances_queryset = target_instances_queryset.order_by('pk')
        target_instances_qs_chunk = target_instances_queryset
        while target_instances_qs_chunk.exists():
            # Take a chunk of the target `Instance`s.
            target_instances_qs_chunk = target_instances_qs_chunk[0:chunk_size]

            for instance in target_instances_qs_chunk:
                pk = instance.pk
                xml = instance.xml
                # Do a `Queryset.update()` on this individual instance to avoid signals triggering
                # things like `Reversion` versioning.
                instances_updated_count = Instance.objects.filter(pk=pk).update(
                    xml_hash=cls.get_hash(xml))
                instances_updated_total += instances_updated_count

            # Set up the next chunk
            target_instances_qs_chunk = target_instances_queryset.filter(
                pk__gt=instance.pk)

        return instances_updated_total

    def get(self, abbreviated_xpath):
        self._set_parser()
        return self._parser.get(abbreviated_xpath)

    def get_dict(self, force_new=False, flat=True):
        """Return a python object representation of this instance's XML."""
        self._set_parser()

        return (
            self._parser.get_flat_dict_with_attributes()
            if flat
            else self._parser.to_dict()
        )

    def get_full_dict(self):
        # TODO should we store all of these in the JSON no matter what?
        d = self.json
        data = {
            UUID: self.uuid,
            ID: self.id,
            self.USERFORM_ID: get_mongo_userform_id(self.xform, self.user.username),
            ATTACHMENTS: [a.media_file.name for a in
                          self.attachments.all()],
            self.STATUS: self.status,
            TAGS: list(self.tags.names()),
            NOTES: self.get_notes()
        }

        d.update(data)

        return d

    def get_notes(self):
        return [note['note'] for note in self.notes.values('note')]

    def get_root_node(self):
        self._set_parser()
        return self._parser.get_root_node()

    def get_root_node_name(self):
        self._set_parser()
        return self._parser.get_root_node_name()

    @staticmethod
    def get_hash(input_string: str) -> str:
        """
        Compute the SHA256 hash of the given string. A wrapper to standardize hash computation.
        """
        return calculate_hash(input_string, 'sha256')

    @property
    def point(self):
        gc = self.geom

        if gc and len(gc):
            return gc[0]

    def save(self, *args, **kwargs):
        force = kwargs.pop('force', False)

        self.check_active(force)

        self._set_geom()
        self._set_json()
        self._set_survey_type()
        self._set_uuid()
        self._populate_xml_hash()
        self._populate_root_uuid()

        # Force validation_status to be dict
        if self.validation_status is None:
            self.validation_status = {}

        super().save(*args, **kwargs)

    def get_validation_status(self):
        """
        Returns instance validation status.

        :return: object
        """
        # This method can be tweaked to implement default validation status
        # For example:
        # if not self.validation_status:
        #    self.validation_status = self.asset.settings.get("validation_statuses")[0]
        return self.validation_status or {}


if Instance.XML_HASH_LENGTH / 2 != sha256().digest_size:
    raise AssertionError('SHA256 hash `digest_size` expected to be `{}`, not `{}`'.format(
        Instance.XML_HASH_LENGTH, sha256().digest_size))


class InstanceHistory(AbstractTimeStampedModel):
    class Meta:
        app_label = 'logger'

    xform_instance = models.ForeignKey(
        Instance,
        related_name='submission_history',
        null=True,
        on_delete=models.SET_NULL,
    )
    xml = models.TextField()
    # old instance id
    uuid = models.CharField(max_length=249, default='', db_index=True)
    root_uuid = models.CharField(max_length=249, null=True, db_index=True)
