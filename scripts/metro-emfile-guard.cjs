/**
 * Soften EMFILE from Node fs.watch under macOS launchctl maxfiles=256.
 * Metro still serves bundles; hot-reload may be partial until maxfiles is raised.
 */
const fs = require('fs');

function attachEmfileGuard(watcher) {
  if (!watcher || typeof watcher.on !== 'function') return watcher;
  watcher.on('error', (err) => {
    if (err && (err.code === 'EMFILE' || err.errno === -24)) {
      if (!attachEmfileGuard._warned) {
        attachEmfileGuard._warned = true;
        console.warn(
          '[metro] EMFILE on file watch — continuing without full HMR. Raise launchctl maxfiles or use Watchman.',
        );
      }
      return;
    }
    // Re-emit unexpected errors so they are not swallowed forever.
    if (typeof watcher.emit === 'function') {
      watcher.emit('error', err);
    }
  });
  return watcher;
}

const origWatch = fs.watch.bind(fs);
fs.watch = (filename, options, listener) => {
  let watcher;
  try {
    watcher = origWatch(filename, options, listener);
  } catch (err) {
    if (err && (err.code === 'EMFILE' || err.errno === -24)) {
      console.warn('[metro] fs.watch EMFILE for', filename);
      return {
        close() {},
        on() {
          return this;
        },
        addListener() {
          return this;
        },
        removeListener() {
          return this;
        },
        once() {
          return this;
        },
        emit() {
          return false;
        },
      };
    }
    throw err;
  }
  return attachEmfileGuard(watcher);
};
