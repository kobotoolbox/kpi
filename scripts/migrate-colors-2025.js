#!/usr/bin/env node

/**
 * KoBoToolbox 2025 Color Migration Script
 * 
 * This script helps identify components that need color updates
 * and provides guidance for the migration process.
 */

const fs = require('fs');
const path = require('path');

const KOBO_ROOT = process.cwd();
const JSAPP_PATH = path.join(KOBO_ROOT, 'jsapp');

// Color patterns to find in existing code
const OLD_COLOR_PATTERNS = [
  /\$kobo-gray-\d+/g,
  /\$kobo-blue/g,
  /\$kobo-teal/g,
  /\$kobo-red/g,
  /\$kobo-amber/g,
  /colors\.\$kobo-/g,
];

// Files to prioritize for migration
const PRIORITY_COMPONENTS = [
  'components/_kobo.button.scss',
  'components/_kobo.navigation.scss',
  'components/_kobo.form-view.scss',
  'stylesheets/partials/buttons.scss',
];

/**
 * Scan files for old color usage
 */
function scanForOldColors(dirPath, results = []) {
  const files = fs.readdirSync(dirPath);
  
  files.forEach(file => {
    const filePath = path.join(dirPath, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory() && !file.startsWith('.')) {
      scanForOldColors(filePath, results);
    } else if (file.endsWith('.scss') || file.endsWith('.css')) {
      const content = fs.readFileSync(filePath, 'utf8');
      const oldColorMatches = OLD_COLOR_PATTERNS.some(pattern => pattern.test(content));
      
      if (oldColorMatches) {
        results.push({
          file: path.relative(KOBO_ROOT, filePath),
          priority: PRIORITY_COMPONENTS.some(pc => filePath.includes(pc)) ? 'HIGH' : 'MEDIUM',
        });
      }
    }
  });
  
  return results;
}

/**
 * Generate migration report
 */
function generateMigrationReport() {
  console.log('🎨 KoBoToolbox 2025 Color Migration Analysis\n');
  
  // Scan SCSS files
  const scssResults = scanForOldColors(path.join(JSAPP_PATH, 'scss'));
  const componentResults = scanForOldColors(path.join(JSAPP_PATH, 'js'));
  
  const allResults = [...scssResults, ...componentResults];
  const highPriority = allResults.filter(r => r.priority === 'HIGH');
  const mediumPriority = allResults.filter(r => r.priority === 'MEDIUM');
  
  console.log(`📊 Migration Summary:`);
  console.log(`   Total files with old colors: ${allResults.length}`);
  console.log(`   High priority files: ${highPriority.length}`);
  console.log(`   Medium priority files: ${mediumPriority.length}\n`);
  
  if (highPriority.length > 0) {
    console.log('🔥 HIGH PRIORITY - Migrate these first:');
    highPriority.forEach(result => {
      console.log(`   - ${result.file}`);
    });
    console.log('');
  }
  
  if (mediumPriority.length > 0) {
    console.log('📋 MEDIUM PRIORITY - Migrate after high priority:');
    mediumPriority.slice(0, 10).forEach(result => {
      console.log(`   - ${result.file}`);
    });
    if (mediumPriority.length > 10) {
      console.log(`   ... and ${mediumPriority.length - 10} more files`);
    }
    console.log('');
  }
  
  console.log('📝 Next Steps:');
  console.log('   1. Provide 2025 design guideline colors');
  console.log('   2. Update colors-2025.scss with real values');
  console.log('   3. Test color system with test-2025-colors.html');
  console.log('   4. Begin migrating high priority components');
  console.log('   5. Run this script again to track progress\n');
}

/**
 * Check if 2025 system is ready
 */
function check2025SystemStatus() {
  const colors2025Path = path.join(JSAPP_PATH, 'scss', 'colors-2025.scss');
  const theme2025Path = path.join(JSAPP_PATH, 'js', 'theme', 'kobo', 'theme-2025.ts');
  
  console.log('🔍 2025 System Status Check:');
  
  if (fs.existsSync(colors2025Path)) {
    const content = fs.readFileSync(colors2025Path, 'utf8');
    const hasPlaceholders = content.includes('#placeholder');
    console.log(`   ✅ colors-2025.scss exists`);
    console.log(`   ${hasPlaceholders ? '⚠️' : '✅'} Color values ${hasPlaceholders ? 'need updates (placeholders found)' : 'defined'}`);
  } else {
    console.log('   ❌ colors-2025.scss missing');
  }
  
  if (fs.existsSync(theme2025Path)) {
    console.log('   ✅ theme-2025.ts exists');
  } else {
    console.log('   ❌ theme-2025.ts missing');
  }
  
  console.log('');
}

// Run the analysis
if (require.main === module) {
  check2025SystemStatus();
  generateMigrationReport();
}

module.exports = {
  scanForOldColors,
  generateMigrationReport,
  check2025SystemStatus,
};
