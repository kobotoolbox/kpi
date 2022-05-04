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
