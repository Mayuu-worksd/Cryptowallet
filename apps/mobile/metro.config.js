const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

process.env.EXPO_NO_METRO_WORKSPACE_ROOT = '1';

const projectRoot = __dirname;
const monorepoRoot = path.resolve(__dirname, '../..');

const config = getDefaultConfig(projectRoot);

config.projectRoot = projectRoot;
const monorepoNodeModules = path.join(monorepoRoot, 'node_modules');
config.watchFolders = [
  projectRoot,
  ...(require('fs').existsSync(monorepoNodeModules) ? [monorepoNodeModules] : []),
];

config.server = {
  ...config.server,
  unstable_serverRoot: projectRoot,
};

config.maxWorkers = 1;

config.transformer = {
  ...config.transformer,
  unstable_allowRequireContext: true,
};

const NOOP = path.resolve(projectRoot, 'utils/noopModule.js');

const NODE_SHIMS = {
  buffer: require.resolve('buffer/'),
  stream: require.resolve('stream-browserify'),
  events: require.resolve('events/'),
  url:    require.resolve('url/'),
  http:   NOOP,
  https:  NOOP,
  net:    NOOP,
  tls:    NOOP,
  zlib:   NOOP,
  fs:     NOOP,
  crypto: require.resolve('react-native-get-random-values'),
};

config.resolver.blockList = [
  /\.kilocode[\/\\].*/,
];

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'ws' || moduleName.startsWith('ws/')) {
    return { filePath: NOOP, type: 'sourceFile' };
  }
  const shim = NODE_SHIMS[moduleName];
  if (shim) return { filePath: shim, type: 'sourceFile' };
  return context.resolveRequest(context, moduleName, platform);
};

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  buffer: require.resolve('buffer/'),
  stream: require.resolve('stream-browserify'),
  events: require.resolve('events/'),
  url:    require.resolve('url/'),
  http:   NOOP,
  https:  NOOP,
  net:    NOOP,
  tls:    NOOP,
  zlib:   NOOP,
  fs:     NOOP,
  crypto: require.resolve('react-native-get-random-values'),
};

module.exports = config;
