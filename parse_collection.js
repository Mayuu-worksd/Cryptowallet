const fs = require('fs');

const collection = JSON.parse(fs.readFileSync('striga_collection.json', 'utf8'));

function printItems(items, depth = 0) {
  for (const item of items) {
    const indent = '  '.repeat(depth);
    if (item.item) {
      console.log(`${indent}[Folder] ${item.name}`);
      printItems(item.item, depth + 1);
    } else if (item.request) {
      console.log(`${indent}- ${item.name} [${item.request.method}] ${item.request.url.raw || item.request.url}`);
    }
  }
}

printItems(collection.item);
