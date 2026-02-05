<!-- version number should be already in the releases title, no need to repeat here. -->
## What's changed


<details><summary>Features (8)</summary>

- **analysis**: introduce optional clear button ([#6445](https://github.com/kobotoolbox/kpi/pull/6445))
    > <!-- 📣 Summary -->
    > Modern implementations of radio components don't allow de-selection.
    > After updating the select one question type in the qualitative analysis
    > section to mantine, we lost this functionality. To ensure the ability to
    > de-select select one questions, they will appear with a "clear" button
    > next to the "delete" button

- **billing**: switch asset usage endpoint to limit offset pagination ([#6234](https://github.com/kobotoolbox/kpi/pull/6234))
    > <!-- 📣 Summary -->
    > Removes custom asset usage page-size pagination, thereby using KPI's
    > default limit-offset pagination, and adjusts drf_spectacular code for
    > the endpoint to improve API docs/frontend helpers.

- **exports**: only allow one anonymous export at a time ([#6514](https://github.com/kobotoolbox/kpi/pull/6514))
    > <!-- 📣 Summary -->
    > Only create one export at a time for anonymous users.
    > 
    > <!-- 📖 Description -->
    > If an anonymous user creates an export and another anonymous user
    > attempts to create a new export before the other one is finished, they
    > will receive a 503 error with a message to try again.

- **gallery**: paginated modal for images ([#6521](https://github.com/kobotoolbox/kpi/pull/6521))
    > <!-- 📣 Summary -->
    > 
    > Project → Data → Gallery images now open images in a modal with
    > prev/next pagination.

- **messages**: add user details to in-app messages ([#6569](https://github.com/kobotoolbox/kpi/pull/6569))
    > <!-- 📣 Summary -->
    > Replace selected 'template tags' with user details on in-app messages.

- **submission**: expose meta/rootUuid in UI ([#6557](https://github.com/kobotoolbox/kpi/pull/6557))
    > <!-- 📣 Summary -->
    > 
    > Display `meta/rootUuid` in Data Table, Single Submission modal, and
    > Project Downloads. Also make it possible to include it in exported data.

- **usage**: add LLM requests usage card under feature flag ([#6510](https://github.com/kobotoolbox/kpi/pull/6510))
- add API pagination size configuration constants ([#6689](https://github.com/kobotoolbox/kpi/pull/6689))
    > <!-- 📣 Summary -->
    > This PR introduces `DEFAULT_API_PAGE_SIZE` and `MAX_API_PAGE_SIZE`
    > constants to standardize pagination behavior across API endpoints
    > 
    > <!-- 📖 Description -->
    > This PR adds two configuration constants to control API pagination
    > behavior. `DEFAULT_API_PAGE_SIZE` sets the default page size when no
    > limit is specified in API requests, while `MAX_API_PAGE_SIZE` enforces a
    > maximum limit to prevent oversized responses that could impact system
    > performance. The constants are designed with future-proof naming to
    > support expansion beyond the current submission list endpoints to other
    > API endpoints as needed.

</details>

<details><summary>Bug Fixes (8)</summary>

- **asset**: prevent translation errors after adding hints to a form ([#6587](https://github.com/kobotoolbox/kpi/pull/6587))
    > <!-- 📣 Summary -->
    > Allow users to add hints to forms which have translations before
    > deploying the form.

- **assets**: add unit test for assets' numeric-only search queries ([#6565](https://github.com/kobotoolbox/kpi/pull/6565))
    > <!-- 📣 Summary -->
    > Add unit test to ensure asset search does not crash when numeric-only or
    > float searches are used.
    > 
    > Part of: https://github.com/kobotoolbox/kpi/pull/6563

- **data**: update `/api/v2/data/` limits ([#6472](https://github.com/kobotoolbox/kpi/pull/6472))
    > <!-- 📣 Summary -->
    > Change maximum number of results that `/api/v2/data/` can return to 100
    > by default and 1000 maximum.

- **mfa**: change MFA modal copywriting ([#6536](https://github.com/kobotoolbox/kpi/pull/6536))
    > <!-- 📣 Summary -->
    > Update copywriting in MFA modal

- **migrations**: kpi migration script failure on fresh installs ([#6485](https://github.com/kobotoolbox/kpi/pull/6485))
- **nlp**: don't crash when translating a transcript ([#6532](https://github.com/kobotoolbox/kpi/pull/6532))
    > <!-- 📣 Summary -->
    > 
    > KPI won't crash anymore when clicking "begin" button to add a
    > translation in the NLP view.

- **project**: history buttons overlap ([#6501](https://github.com/kobotoolbox/kpi/pull/6501))
- **projectViews**: searchbox missing in Org View ([#6500](https://github.com/kobotoolbox/kpi/pull/6500))
    > <!-- 📣 Summary -->
    > 
    > Display search in top navigation for organization projects.

</details>

<details><summary>Documentation (2)</summary>

- **hsts**: note that production overrides Django config INFRA-297 ([#6486](https://github.com/kobotoolbox/kpi/pull/6486))
- **link**: update upload form by url support doc link ([#6506](https://github.com/kobotoolbox/kpi/pull/6506))
    > <!-- 📣 Summary -->
    > 
    > Updated the XLSForm import help link to point to the correct support
    > article section with anchor.

</details>

<details><summary>Continous Integration (5)</summary>

- **automation**: push new image tag for main branch to devops/instance-kfmain for deployment INFRA-325 ([#6533](https://github.com/kobotoolbox/kpi/pull/6533))
- **release**: don't run workflow twice on creation ([#6556](https://github.com/kobotoolbox/kpi/pull/6556))
- **releases**: changelog job should handle all cases ([#6546](https://github.com/kobotoolbox/kpi/pull/6546))
- **releases**: pin git-cliff version due breaking changes ([#6568](https://github.com/kobotoolbox/kpi/pull/6568))
- **zulip**: convert stream name to input for zulip workflow ([#6564](https://github.com/kobotoolbox/kpi/pull/6564))
</details>

<details><summary>Build & Dependencies (1)</summary>

- **dev**: add convenience script to run frontend/backend branches separately ([#6490](https://github.com/kobotoolbox/kpi/pull/6490))
</details>

<details><summary>Security (7)</summary>

- **deps**: bump node-forge from 1.3.1 to 1.3.2 in the minor-and-patch group across 1 directory ([#6508](https://github.com/kobotoolbox/kpi/pull/6508))
- **deps**: bump aws-actions/configure-aws-credentials from 5.1.0 to 5.1.1 in the actions-deps group ([#6531](https://github.com/kobotoolbox/kpi/pull/6531))
- **deps**: bump actions/cache from 4 to 5 in the actions-deps group ([#6552](https://github.com/kobotoolbox/kpi/pull/6552))
- **deps**: bump actions/create-github-app-token from 1 to 2 in the actions-deps group ([#6570](https://github.com/kobotoolbox/kpi/pull/6570))
- **deps**: bump qs from 6.13.0 to 6.14.1 in the minor-and-patch group across 1 directory ([#6577](https://github.com/kobotoolbox/kpi/pull/6577))
- **deps**: bump dependabot/fetch-metadata from 2.4.0 to 2.5.0 in the actions-deps group ([#6600](https://github.com/kobotoolbox/kpi/pull/6600))
- **deps-dev**: bump js-yaml from 3.14.1 to 3.14.2 ([#6482](https://github.com/kobotoolbox/kpi/pull/6482))
</details>

<details><summary>Refactor (2)</summary>

- **analysis**: migrate select one form to mantine ([#6462](https://github.com/kobotoolbox/kpi/pull/6462))
- rename retention environment variable to be clearer and more consistent ([#6527](https://github.com/kobotoolbox/kpi/pull/6527))
    > <!-- 📣 Summary -->
    > Improve clarity and consistency of the retention setting name, making it
    > easier for superusers in Constance and for future development.
    > 
    > <!-- 📖 Description -->
    > This refactor updates the name of the retention-related environment
    > variable to a more explicit and consistent form. The clearer naming
    > helps superusers quickly understand its purpose in Constance and reduces
    > ambiguity for developers working with retention logic. No behavioral
    > changes are introduced—only improved readability and maintainability.

</details>

<details><summary>Chores (4)</summary>

- **deps**: bump the actions-deps group across 1 directory with 2 updates ([#6496](https://github.com/kobotoolbox/kpi/pull/6496))
- **deps**: bump the minor-and-patch group across 1 directory with 2 updates ([#6518](https://github.com/kobotoolbox/kpi/pull/6518))
- **deps**: bump the minor-and-patch group across 1 directory with 2 updates ([#6597](https://github.com/kobotoolbox/kpi/pull/6597))
- **submissions**: update anonymous submissions help link ([#6517](https://github.com/kobotoolbox/kpi/pull/6517))
    > <!-- 📣 Summary -->
    > Update the help link for allowing anonymous submissions

</details>

<details><summary>Other (1)</summary>

- Fix uv in pip-compile.sh ([#6562](https://github.com/kobotoolbox/kpi/pull/6562))

Revise pip-compile.sh to add the `--output <OUT_FILE>`
option (requirements.txt)

- pip-compile requirements.in
+ uv pip compile requirements.in --output-file requirements.txt

For more info, see 
https://github.com/kobotoolbox/kpi/pull/6562.

Without --output-file, uv won't infer `requirements.txt` 
from `requirements.in` automatically like pip-tools would.

So you'd get a result equivalent to:

 --update Use latest version of all packages
 (instead of what's in requirements.txt)
 --dry-run Print to stdout only
 (instead of updating requirements.txt
</details>

****

**Full Changelog**: https://github.com/kobotoolbox/kpi/compare/2.025.47g..2.026.03
<!-- generated by git-cliff -->
