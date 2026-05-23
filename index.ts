import './utils/getRandomValuesShim';
// Buffer polyfill for crypto libraries
global.Buffer = global.Buffer || require('buffer').Buffer;
import { registerRootComponent } from 'expo';
import App from './App';
import { setupLogger } from './utils/logger';

// 🔴 Must be first — catches all errors, warnings, and crashes
setupLogger();

console.log('[Boot] index.ts loaded');
console.log('[Boot] Platform:', require('react-native').Platform.OS);
console.log('[Boot] SDK env ready, registering root component...');

registerRootComponent(App);

console.log('[Boot] registerRootComponent called');
