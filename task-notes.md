WIP scratchpad for this PR.
Not intended for merge to main.

-------------------------------

What's here so far:

1. A build stage that produces node_modules and jsapp/fonts.
2. A build stage that produces jsapp/compiled and webpack-stats.json.

What's still TODO:

1. Adapt the main Dockerfile, so that the Python prod image can
   benefit from the improved Node build stage.

What I like:

1. I took a careful approach to file ownership / permissions, using non-root user 1000. Permission problems caused by root ownership tend to be disruptive when they appear downstream, so I think this will be an improvement overall.
2. I've thought carefully about layers and caching. Haven't measured it yet, but during a normal workday, I suspect the median kpi image dev build could be 10-40 seconds faster than before.


Notes for reviewer:

There might be a leftover `taskfile.yml` in the PR at review time. Before merging to main, I'll delete it. Until then, maybe it's useful as context.

------

Future plans? 

1. If/when we want to start serving the webpack dev server in another container, or separate dev/prod containers, this is a good starting point. The separate node build stage makes its dependencies rather explicit.


------

#### Scratchpad

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

