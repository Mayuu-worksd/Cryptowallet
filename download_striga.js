const fs = require('fs');

async function download(url, filename) {
  try {
    console.log(`Downloading ${url} to ${filename}...`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const json = await res.json();
    fs.writeFileSync(filename, JSON.stringify(json, null, 2), 'utf8');
    console.log(`Saved ${filename}`);
  } catch (error) {
    console.error(`Error downloading ${url}:`, error);
  }
}

async function run() {
  await download('https://storage.googleapis.com/striga-public-docs/enivronment.json', 'striga_environment.json');
  await download('https://storage.googleapis.com/striga-public-docs/collection.json', 'striga_collection.json');
}

run();
