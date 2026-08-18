def get_survey_question_type(
    asset: 'kpi.models.Asset', question_xpath: str
) -> str | None:
    """
    Return the survey question `type` for an xpath, or None when not found.

    Missing `$xpath` values are injected on demand, mirroring
    `Asset.get_attachment_xpaths_from_version`. Returns None for unresolvable
    xpaths (older versions, group edge cases) so callers can skip silently.
    """
    content = getattr(asset, 'content', None)
    if not isinstance(content, dict):
        return None
    survey = content.get('survey')
    if not isinstance(survey, list):
        return None

    def _find() -> str | None:
        for question in survey:
            if question.get('$xpath') == question_xpath:
                return question.get('type')
        return None

    question_type = _find()
    if question_type is not None:
        return question_type

    if any('$xpath' not in question for question in survey):
        # Inject missing `$xpath` properties and retry once
        asset._insert_xpath(content)
        return _find()
    return None
