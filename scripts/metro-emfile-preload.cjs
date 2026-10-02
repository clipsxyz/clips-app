process.on('uncaughtException', (err) => {
  if (err && (err.code === 'EMFILE' || /EMFILE/.test(String(err.message || '')))) {
    console.warn('[metro-emfile-guard] Ignoring file-watcher EMFILE; bundler stays up.');
    return;
  }
  console.error(err);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  const msg = reason && (reason.message || String(reason));
  if (reason && (reason.code === 'EMFILE' || /EMFILE/.test(String(msg || '')))) {
    console.warn('[metro-emfile-guard] Ignoring file-watcher EMFILE rejection; bundler stays up.');
    return;
  }
  console.error(reason);
  process.exit(1);
});
