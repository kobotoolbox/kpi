<!-- version number should be already in the releases title, no need to repeat here. -->
## What's changed


<details><summary>Features (5)</summary>

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

- **usage**: add LLM requests usage card under feature flag ([#6510](https://github.com/kobotoolbox/kpi/pull/6510))
</details>

<details><summary>Bug Fixes (7)</summary>

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

<details><summary>Continous Integration (1)</summary>

- **releases**: changelog job should handle all cases ([#6546](https://github.com/kobotoolbox/kpi/pull/6546))
</details>

<details><summary>Security (4)</summary>

- **deps**: bump node-forge from 1.3.1 to 1.3.2 in the minor-and-patch group across 1 directory ([#6508](https://github.com/kobotoolbox/kpi/pull/6508))
- **deps**: bump aws-actions/configure-aws-credentials from 5.1.0 to 5.1.1 in the actions-deps group ([#6531](https://github.com/kobotoolbox/kpi/pull/6531))
- **deps**: bump actions/cache from 4 to 5 in the actions-deps group ([#6552](https://github.com/kobotoolbox/kpi/pull/6552))
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

<details><summary>Chores (3)</summary>

- **deps**: bump the actions-deps group across 1 directory with 2 updates ([#6496](https://github.com/kobotoolbox/kpi/pull/6496))
- **deps**: bump the minor-and-patch group across 1 directory with 2 updates ([#6518](https://github.com/kobotoolbox/kpi/pull/6518))
- **submissions**: update anonymous submissions help link ([#6517](https://github.com/kobotoolbox/kpi/pull/6517))
    > <!-- 📣 Summary -->
    > Update the help link for allowing anonymous submissions

</details>

****

**Full Changelog**: https://github.com/kobotoolbox/kpi/compare/2.025.47b..2.025.51
<!-- generated by git-cliff -->
