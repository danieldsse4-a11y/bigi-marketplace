// Reads the public site's demo data (bigi/data.js — plain browser globals) so
// the server can list the sample suppliers in the admin area and serve a
// filtered copy of data.js to visitors.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DATA_JS_PATH = path.join(__dirname, '..', '..', 'bigi', 'data.js');

function readSiteData() {
  const source = fs.readFileSync(DATA_JS_PATH, 'utf8');
  const names = [...source.matchAll(/^const\s+([A-Z_]+)\s*=/gm)].map((m) => m[1]);
  // Top-level consts aren't properties of the vm global, so return them explicitly.
  const values = vm.runInNewContext(`${source}\n;({ ${names.join(', ')} })`, {}, { filename: 'data.js' });
  return { names, values };
}

const { names: CONST_NAMES, values: SITE_DATA } = readSiteData();
const CATEGORIES = SITE_DATA.CATEGORIES;
const CITIES = SITE_DATA.CITIES;
const SAMPLE_VENDORS = SITE_DATA.VENDORS;

function categoryById(id) {
  return CATEGORIES.find((c) => c.id === id) || null;
}

module.exports = { CONST_NAMES, SITE_DATA, CATEGORIES, CITIES, SAMPLE_VENDORS, categoryById };
