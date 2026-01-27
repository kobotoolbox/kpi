WIP scratchpad for this PR.
Not intended for merge to main.

-------------------------------



```Dockerfile
# webpack-build-prod
COPY --from=npm-install /srv/src/kpi/ .
# COPY --from=npm-install --parents \
#     /srv/src/kpi/./jsapp/fonts/   \
#     /srv/src/kpi/./msw-mocks/     \
#     /srv/src/kpi/./node_modules/  \
#     /srv/src/kpi/./jsapp/k-icons-css-template.hbs \
#     /srv/src/kpi/./jsapp/svg-icons/               \
#     /srv/src/kpi/./patches/                       \
#     /srv/src/kpi/./.browserslistrc                \
#     /srv/src/kpi/./package.json                   \
#     /srv/src/kpi/./package-lock.json              \
#     .
```

