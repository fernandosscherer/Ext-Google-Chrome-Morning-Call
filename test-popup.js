import fs from 'fs';
import { JSDOM } from 'jsdom';

const html = fs.readFileSync('extension/popup.html', 'utf8');

const dom = new JSDOM(html, {
  url: 'chrome-extension://dummy/',
  runScripts: 'dangerously',
  resources: 'usable'
});

dom.window.chrome = {
  storage: {
    sync: { get: async () => ({}), set: async () => {} },
    local: { get: async () => ({}), set: async () => {} }
  },
  alarms: { create: () => {}, onAlarm: { addListener: () => {} } },
  runtime: { onInstalled: { addListener: () => {} } }
};

// We can't easily execute ES modules directly from file system in JSDOM out-of-the-box,
// but we can just dynamically import the modules to check for top-level errors.

import('./extension/js/popup.js').then(module => {
  console.log("popup.js imported successfully");
}).catch(err => {
  console.error("Error importing popup.js:", err);
});
