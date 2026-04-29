const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

const NOOP = path.resolve(__dirname, 'utils/noopModule.js');

// Intercept 'ws' — it's a Node-only WebSocket lib bundled inside @supabase/realtime-js.
// React Native has a built-in WebSocket global, so we shim ws to an empty module.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'ws' || moduleName.startsWith('ws/')) {
    return { filePath: NOOP, type: 'sourceFile' };
  }
  return context.resolveRequest(context, moduleName, platform);
};

// Polyfill other Node built-ins that libraries may reference
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  stream:  require.resolve('stream-browserify'),
  events:  require.resolve('events/'),
  buffer:  require.resolve('buffer/'),
  url:     require.resolve('url/'),
  http:    NOOP,
  https:   NOOP,
  net:     NOOP,
  tls:     NOOP,
  zlib:    NOOP,
  fs:      NOOP,
  crypto:  require.resolve('react-native-get-random-values'),
};

module.exports = config;
