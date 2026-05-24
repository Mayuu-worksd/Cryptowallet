/**
 * Global error logger — hooks into the JS runtime so every crash,
 * unhandled promise rejection, and console.error prints a clean
 * stack trace in the Metro terminal.
 *
 * Call setupLogger() once at the very top of index.ts / App.tsx.
 */

const TAG = {
  error:   '🔴 [ERROR]',
  warn:    '🟡 [WARN] ',
  info:    '🔵 [INFO] ',
  promise: '💥 [UNHANDLED PROMISE]',
  crash:   '☠️  [CRASH]',
};

function fmt(label: string, msg: any, extra?: any) {
  const time = new Date().toLocaleTimeString();
  console.log(`\n${label} ${time}`);
  console.log(typeof msg === 'string' ? msg : JSON.stringify(msg, null, 2));
  if (extra) console.log(extra);
  console.log('─'.repeat(60));
}

export function setupLogger() {
  // ── Intercept console.error ──────────────────────────────────
  const _error = console.error.bind(console);
  console.error = (...args: any[]) => {
    fmt(TAG.error, args[0], args.slice(1).join(' '));
    _error(...args);
  };

  // ── Intercept console.warn ───────────────────────────────────
  const _warn = console.warn.bind(console);
  console.warn = (...args: any[]) => {
    fmt(TAG.warn, args[0], args.slice(1).join(' '));
    _warn(...args);
  };

  // ── Unhandled JS errors (crashes) ────────────────────────────
  const prevHandler = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
    fmt(
      isFatal ? TAG.crash : TAG.error,
      `${isFatal ? 'FATAL — ' : ''}${error?.message ?? error}`,
      error?.stack
    );
    prevHandler(error, isFatal);
  });

  // ── Unhandled promise rejections ─────────────────────────────
  const tracking = global as any;
  if (!tracking.__loggerPromiseHooked) {
    tracking.__loggerPromiseHooked = true;
    // React Native's Hermes surfaces these via the global handler above,
    // but we also patch the native unhandledrejection event for web/Node.
    if (typeof (global as any).addEventListener === 'function') {
      (global as any).addEventListener('unhandledrejection', (event: any) => {
        fmt(TAG.promise, event?.reason?.message ?? event?.reason, event?.reason?.stack);
      });
    }
  }

  fmt(TAG.info, '✅ Logger active — errors will print here with stack traces');
}
