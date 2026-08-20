// Polyfills that must be loaded before anything else.
// Written as require() only — no import statements — so Metro resolves
// this file as a plain CommonJS module with no entry-file restrictions.

// 1. crypto.getRandomValues
try {
  require('react-native-get-random-values');
} catch (_e) {}

if (typeof global.crypto !== 'object') {
  global.crypto = {};
}
if (typeof global.crypto.getRandomValues !== 'function') {
  global.crypto.getRandomValues = function (array) {
    for (var i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return array;
  };
}

// 2. Buffer — require('buffer/') resolves to the browser-compatible package
//    via metro.config.js extraNodeModules / resolveRequest mapping.
if (typeof global.Buffer === 'undefined') {
  try {
    global.Buffer = require('buffer/').Buffer;
  } catch (_e) {}
}
