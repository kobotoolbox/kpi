<!-- version number should be already in the releases title, no need to repeat here. -->
## What's changed


<details><summary>Features (2)</summary>

- **dataTable**: display verification column ([#6822](https://github.com/kobotoolbox/kpi/pull/6822))
    > <!-- 📣 Summary -->
    > 
    > Display verification value in Data Table and Single Submission Modal.

- **metadata**: add custom django admin form for ExtraProjectMetadata ([#6801](https://github.com/kobotoolbox/kpi/pull/6801))
    > <!-- 📣 Summary -->
    > Adds an interface in the Django admin for superusers to easily define
    > and manage custom project metadata fields.

</details>

<details><summary>Bug Fixes (11)</summary>

- **admin**: render constance list/dict fields as valid JSON in admin ([b1f4781](https://github.com/kobotoolbox/kpi/commit/b1f47810e543d24183dd1db9f9d3a0e5a6e41427))
- **constance**: clear stale Redis cache and fix provision_server JSON parsing ([e58e946](https://github.com/kobotoolbox/kpi/commit/e58e9464f6f76e2daf393daab2710fb11b2f86e1))
- **constance**: `JsonSchemaFormField.clean()` must return parsed object ([#6968](https://github.com/kobotoolbox/kpi/pull/6968))
    > <!-- 📣 Summary -->
    > 
    > Saving certain admin settings (MFA help text, password guidance,
    > user/project metadata fields) via the Django admin could cause crashes
    > for end users, such as a broken MFA login flow or broken user profile
    > pages.

- **constance**: repair migration 0020 for constance 4 envelope format ([#6973](https://github.com/kobotoolbox/kpi/pull/6973))
    > <!-- 📣 Summary -->
    > 
    > Follow-up to #6968. Migration `0020_fix_constance_json_field_corruption`
    > was silently skipping all records modified by Constance own migration
    > and not repairing corrupted constance values, causing a 500 error on
    > `/environment/`.

- **debug-toolbar**: handle import error for debug toolbar in development settings ([#6970](https://github.com/kobotoolbox/kpi/pull/6970))
- **docker**: compile translations at build time ([#6852](https://github.com/kobotoolbox/kpi/pull/6852))
- **languages**: allow imports of large language files ([#6849](https://github.com/kobotoolbox/kpi/pull/6849))
    > <!-- 📣 Summary -->
    > Fix an error when importing a large language file into Django admin.

- **projects**: allow admin to delete a single project ([#6842](https://github.com/kobotoolbox/kpi/pull/6842))
    > <!-- 📣 Summary -->
    > Fixes an issue where the admin of an organization cannot delete one
    > single project (deleting multiple was still possible).

- **qual**: allow empty answers to single-select questions ([#6850](https://github.com/kobotoolbox/kpi/pull/6850))
    > <!-- 📣 Summary -->
    > Treat no response selected as a legitimate LLM answer to a select one
    > question.
    > 
    > <!-- 📖 Description -->
    > Previously, if the LLM did not return a selection for a select one
    > question, it was treated as an error. This PR treats those responses as
    > legitimate.

- migration conflict ([9864b38](https://github.com/kobotoolbox/kpi/commit/9864b3898b11492063f914bd5793d6bd36af4468))
- avoid 500 error when debugtool bar is not installed yet ([3672515](https://github.com/kobotoolbox/kpi/commit/36725150e9a3ce0562422659189ddd9cc2e42441))
</details>

<details><summary>Continous Integration (1)</summary>

- **releases**: avoid race conditions ([#6841](https://github.com/kobotoolbox/kpi/pull/6841))
</details>

<details><summary>Build & Dependencies (1)</summary>

- **locale**: delete obsolete submodule logic ([#6845](https://github.com/kobotoolbox/kpi/pull/6845))
</details>

<details><summary>Testing (1)</summary>

- **provision_server**: update assertions to expect parsed JSON objects ([e82e9a7](https://github.com/kobotoolbox/kpi/commit/e82e9a7f4e591fcef0c4265e11b2f540b8bc0a02))
</details>

<details><summary>Refactor (3)</summary>

- **assetQuickActions**: migrate out of allAssets ([#6814](https://github.com/kobotoolbox/kpi/pull/6814))
- **surveyCompanionStore**: tsify ([#6854](https://github.com/kobotoolbox/kpi/pull/6854))
- remove to_python_object wrapper, constance 4 returns Python objects ([0db4fb9](https://github.com/kobotoolbox/kpi/commit/0db4fb9104278fe28a47af35e05bd5893e949002))
</details>

<details><summary>Styling (1)</summary>

- apply linter and formatter ([#6819](https://github.com/kobotoolbox/kpi/pull/6819))
    > <!-- 📣 Summary -->
    > 
    > Internal only — no user-facing changes.
    > 
    > <!-- 📖 Description -->
    > 
    > Applies linter and formatter fixes accumulated from the Django 4.2→5.2
    > and constance 3→4 upgrade commits. No logic changes.

</details>

<details><summary>Chores (13)</summary>

- **deps**: remove django-reversion package ([#6820](https://github.com/kobotoolbox/kpi/pull/6820))
    > <!-- 📣 Summary -->
    > 
    > django-reversion was still listed as a dependency despite no longer
    > being actively used, leaving orphaned tables and dead code in the
    > project.
    > 
    > <!-- 📖 Description -->
    > 
    > django-reversion was removed from active use some time ago (the FK from
    > `AssetVersion` was dropped in migration 0069), but the Python package,
    > app registration, and a long-running migration referencing it were never
    > cleaned up. This removes everything while keeping the underlying
    > database tables intact for now, then permanently drops them via
    > dedicated migrations.

- **deps**: upgrade Python to 3.12 ([#6793](https://github.com/kobotoolbox/kpi/pull/6793))
    > <!-- 📣 Summary -->
    > 
    > Upgrades the backend runtime to Python 3.12 .

- **deps**: upgrade Django 5.1 → 5.2 ([038ae5d](https://github.com/kobotoolbox/kpi/commit/038ae5df5321c7e0915dbc12f7b5353cc9abcf75))
- **deps**: unpin and bump pip dependencies for Django 5.2 ([#6917](https://github.com/kobotoolbox/kpi/pull/6917))
- **locale**: move submodule into parent module ([#6840](https://github.com/kobotoolbox/kpi/pull/6840))
- upgrade Django from 4.2 to 5.0 ([12724fd](https://github.com/kobotoolbox/kpi/commit/12724fd469ff19657da6da2b4a993d020232b5bc))
- upgrade Django from 5.0 to 5.1 ([d465915](https://github.com/kobotoolbox/kpi/commit/d4659152035b1ac41007dc71132aaf7e05c5e7aa))
- upgrade Django from 5.1 to 5.2 and constance from 3.x to 4.x ([c5b0f68](https://github.com/kobotoolbox/kpi/commit/c5b0f685cfbe68f2550cd37e0d41c885411a4de9))
- remove custom constance DatabaseBackend fixed upstream in v4 ([dc23024](https://github.com/kobotoolbox/kpi/commit/dc23024e0cb34db6f7f660fe75d826953c6ddfc5))
- upgrade django-redis to 6.0.0 ([a8487fb](https://github.com/kobotoolbox/kpi/commit/a8487fb0fdc2f334357b3885bdc0c48977cd982a))
- bump django-digest and python-digest to latest commits ([8887aad](https://github.com/kobotoolbox/kpi/commit/8887aad5bf0891d90c4815303839b4c4b1aa0ed5))
- update OpenRosa OpenAPI schema ([022b188](https://github.com/kobotoolbox/kpi/commit/022b188b1651799ad78737e7e08ca051ce4f7f02))
- upgrade Django to 5.2 ([#6818](https://github.com/kobotoolbox/kpi/pull/6818))
    > <!-- 📣 Summary -->
    > 
    > Internal upgrade — no user-facing changes.
    > 
    > <!-- 📖 Description -->
    > 
    > Django 4.2 reached end-of-life. This upgrades the stack from Django 4.2
    > to 5.2 (LTS) in three steps (4.2→5.0→5.1→5.2), upgrades
    > `django-constance` from 3.x to 4.x.
    > 
    > The constance 4 upgrade is the most impactful change: it replaces the
    > pickle-based DB backend with a JSON codec. Any existing pickle-stored
    > values are automatically converted by the `0003_drop_pickle` migration
    > on first deploy.
    > 
    > ### 👷 Description for instance maintainers
    > 
    > Django 5.2 (LTS) replaces 4.2 (EOL). Run `./scripts/migrate.sh` on first
    > deploy — the `constance.0003_drop_pickle` migration will convert any
    > remaining pickle values in the DB to JSON automatically.

</details>

****

**Full Changelog**: https://github.com/kobotoolbox/kpi/compare/2.026.12c..2.026.13
<!-- generated by git-cliff -->
