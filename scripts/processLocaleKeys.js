import fs from 'fs';
import path from 'path';

// Read all files in the src directory recursively
// Look for the `t` function and extract the string
// Write the strings to a file


const srcDir = path.join('./jsapp');
const outputFile = path.join('.', 'all_keys.json');

function readFilesRecursively(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach((file) => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      readFilesRecursively(filePath, fileList);
    } else if (filePath.match(/(.tsx|.ts|.es6|.js|.jsx)$/)) {
      fileList.push(filePath);
    }
  });
  return fileList;
}

function extractStringsFromFiles(files) {
  const strings = [];

  const tFunctionRegex = /(\W)t\(.*?('(([^'\\]?|\\.)*)'|"(([^"\\]?|\\.)*)"|`(([^`\\]?|\\.)*)`).*?(,)?.*?\)/gs;

  files.forEach((file) => {
    // if (!file.includes('ProcessOverview')) return

    const content = fs.readFileSync(file, 'utf-8');
    const matches = Array.from(content.matchAll(tFunctionRegex));

    // Extract the string from the match
    if (matches?.length) {
      console.log(`\n🔍 Matches on file: ${file}`);
      const strs = matches.map((m) => m[2]);

      strs.forEach((str) => {
        console.log(`  - ${str}`);
      });

      //   console.log('File: ', file, strs.length)
      if (file.includes('nav')) {
        // console.log(strs)
      }
      strings.push(...strs);
    }

    // console.log(strs)
  });

  return strings;
}

function writeStringsToFile(strings, outputFile) {
  console.log(`\n\n▶️  Keys found: ${strings.length}`);
  const uniqueStrings = Array.from(new Set(strings)).sort();
  console.log(`▶️  Unique keys: ${uniqueStrings.length}`);
  fs.writeFileSync(outputFile, JSON.stringify(uniqueStrings, null, 2));
}

console.log('\n\n🔵 Processing locale keys...');
const files = readFilesRecursively(srcDir);

// console.log(files)

const strings = extractStringsFromFiles(files);
writeStringsToFile(strings, outputFile);
console.log(`✅ Generated file with all keys: ${outputFile}\n\n`);
