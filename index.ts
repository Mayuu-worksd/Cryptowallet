import './utils/getRandomValuesShim';
// Buffer polyfill for crypto libraries
global.Buffer = global.Buffer || require('buffer').Buffer;
// @ethersproject/shims must come after the crypto polyfill
import '@ethersproject/shims';
import { registerRootComponent } from 'expo';
import App from './App';

console.log('[Boot] index.ts loaded');
console.log('[Boot] Platform:', require('react-native').Platform.OS);
console.log('[Boot] SDK env ready, registering root component...');

registerRootComponent(App);

console.log('[Boot] registerRootComponent called');
