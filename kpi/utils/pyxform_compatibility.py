from io import BytesIO
from pyxform.constants import ALLOW_CHOICE_DUPLICATES


def allow_choice_duplicates(content: dict) -> None:
    """
    Modify `content` to include `allow_choice_duplicates=Yes` in the settings
    so long as that setting does not already exist.
    This should *not* be done for content that's being newly updated by a user,
    but rather *only* for internal conversions of existing content, e.g. when
    generating XML for an `AssetVersion` that was created prior to pyxform
    prohibiting duplicate choice values (aka choice names).
    See https://github.com/kobotoolbox/kpi/issues/3751
    """
    settings = content.setdefault('settings', {})
    if ALLOW_CHOICE_DUPLICATES not in settings:
        settings[ALLOW_CHOICE_DUPLICATES] = 'yes'


class NamedBytesIO(BytesIO):
    """
    Changes in XLSForm/pyxform#718 prevent
    `pyxform.builder.create_survey_from_xls()` from accepting a
    `django.db.models.fields.files.FieldFile`. Only instances of
    `bytes | BytesIO | IOBase` are now accepted for treatment as file-like
    objects, and furthermore, anything that is not already a `BytesIO` will
    have its contents placed inside a newly instantiated one.

    Problem: `BytesIO`s do not have `name`s, and the constructor for
    `pyxform.xls2json.SurveyReader` fails because of that.

    Workaround: a `BytesIO` with a `name` 🙃

    For more details, see
    https://github.com/kobotoolbox/kpi/pull/5126#discussion_r1829763316
    """

    def __init__(self, *args, name=None, **kwargs):
        if name is None:
            raise NotImplementedError('Use `BytesIO` if no `name` is needed')
        super().__init__(*args, **kwargs)
        self.name = name

    @classmethod
    def fromfieldfile(cls, django_fieldfile):
        """
        Given a Django `FieldFile`, return an instance of `NamedBytesIO`

        à la `datetime.datetime.fromtimestamp()`
        """
        new_instance = cls(django_fieldfile.read(), name=django_fieldfile.name)
        django_fieldfile.seek(0)  # Be kind: rewind
        return new_instance
