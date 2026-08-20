from django.conf import settings
from django.core.cache import cache


def get_default_language(asset: 'kpi.models.Asset') -> str | None:
    """
    Return the form's `default_language` setting, or None when unset.
    """
    return _get_survey_metadata(asset)['default_language']


def get_survey_question_type(
    asset: 'kpi.models.Asset', question_xpath: str
) -> str | None:
    """
    Return the survey question `type` for an xpath, or None when not found.

    Callers may skip silently on None: an xpath can be unresolvable for older
    versions or group edge cases.
    """
    return _get_survey_metadata(asset)['question_types'].get(question_xpath)


def _build_survey_metadata(asset: 'kpi.models.Asset', content: dict) -> dict:
    """
    Map every question xpath in `content` to its type, with the default language.

    Missing `$xpath` values are injected on demand, mirroring
    `Asset.get_attachment_xpaths_from_version()`.
    """
    if not isinstance(content, dict):
        return {'question_types': {}, 'default_language': None}

    survey = content.get('survey')
    if not isinstance(survey, list):
        survey = []
    elif any('$xpath' not in question for question in survey):
        asset._insert_xpath(content)

    asset_settings = content.get('settings') or {}

    return {
        'question_types': {
            question['$xpath']: question.get('type')
            for question in survey
            if question.get('$xpath')
        },
        'default_language': asset_settings.get('default_language'),
    }


def _get_survey_metadata(asset: 'kpi.models.Asset') -> dict:
    """
    Return `{'question_types': {xpath: type}, 'default_language': str | None}`.

    Deployed assets are described by their latest deployed version, never by
    `Asset.content`, which keeps drafting a new version from changing how
    submissions of the deployed one are processed. Reading either is expensive
    and deliberately deferred by hot callers such as the bulk action tasks, so
    the result is memoized on the instance and cached per deployed version,
    exactly like `Asset.get_all_attachment_xpaths()` does. Undeployed assets
    fall back to `Asset.content` and are not cached, since it changes freely.
    """
    if (memoized_metadata := getattr(asset, '_survey_metadata', None)) is not None:
        return memoized_metadata

    # Resolving the uid alone avoids loading `AssetVersion.content` on a hit
    version_uid = asset.latest_deployed_version_uid

    if not version_uid:
        asset._survey_metadata = _build_survey_metadata(asset, asset.content)
        return asset._survey_metadata

    cache_key = f'survey_metadata:{asset.uid}:{version_uid}'
    if (cached_metadata := cache.get(cache_key)) is not None:
        asset._survey_metadata = cached_metadata
        return cached_metadata

    version_content = asset.latest_deployed_version.to_formpack_schema()['content']
    metadata = _build_survey_metadata(asset, version_content)

    cache.set(cache_key, metadata, timeout=settings.SURVEY_METADATA_CACHE_TTL)
    asset._survey_metadata = metadata
    return metadata
