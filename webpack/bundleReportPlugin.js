const fs = require('fs')
const path = require('path')

const REPORT_PATH = path.resolve(__dirname, '../webpack-bundle-report.json')
const DEV_ONLY_MODULE = /\.(stories|mocks)\.|[\\/](msw|msw-mocks)[\\/]/

/** Groups a module path by npm package, or by its first `depth` folders for our own code. */
function getModuleGroup(resource, depth = 3) {
  const packages = resource.match(/node_modules[\\/]((?:@[^\\/]+[\\/])?[^\\/]+)/g)
  if (packages) {
    return packages[packages.length - 1].replace(/^node_modules[\\/]/, '')
  }
  return path.relative(path.resolve(__dirname, '..'), resource).split(path.sep).slice(0, depth).join('/')
}

/** The chunk's modules, with concatenated ones unpacked into the files they're made of. */
function* getSourceModules(chunkGraph, chunk) {
  for (const module of chunkGraph.getChunkModulesIterable(chunk)) {
    yield* module.modules ?? [module]
  }
}

/**
 * Writes what `scripts/check_bundle_size.js` needs and `webpack-stats.json` lacks: sizes per package for each
 * entry's initial chunks (before minification), and any dev-only modules that ended up in the build.
 */
class BundleReportPlugin {
  apply(compiler) {
    compiler.hooks.done.tap('BundleReportPlugin', ({ compilation }) => {
      const { chunkGraph } = compilation
      const entries = {}
      for (const [entryName, entrypoint] of compilation.entrypoints) {
        const groups = {}
        for (const chunk of entrypoint.chunks) {
          for (const module of getSourceModules(chunkGraph, chunk)) {
            const group = getModuleGroup(module.nameForCondition() ?? module.identifier())
            groups[group] = (groups[group] ?? 0) + module.size()
          }
        }
        entries[entryName] = groups
      }

      const devOnlyModules = new Set()
      for (const chunk of compilation.chunks) {
        for (const module of getSourceModules(chunkGraph, chunk)) {
          const resource = module.nameForCondition()
          if (resource && DEV_ONLY_MODULE.test(resource)) {
            devOnlyModules.add(getModuleGroup(resource, Number.POSITIVE_INFINITY))
          }
        }
      }

      fs.writeFileSync(REPORT_PATH, JSON.stringify({ entries, devOnlyModules: [...devOnlyModules].sort() }, null, 2))
    })
  }
}

module.exports = { BundleReportPlugin, REPORT_PATH }
