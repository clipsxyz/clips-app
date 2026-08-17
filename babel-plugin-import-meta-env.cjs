/**
 * Hermes does not support import.meta. Map Vite-style env reads to process.env for Metro bundles.
 * Also inlines VITE_* / EXPO_PUBLIC_* values from the repo `.env` so RN can read them at runtime.
 */
const fs = require('fs');
const path = require('path');

function loadDotEnv() {
  const env = {};
  try {
    const envPath = path.resolve(__dirname, '.env');
    if (!fs.existsSync(envPath)) return env;
    const text = fs.readFileSync(envPath, 'utf8');
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      if (!/^(VITE_|EXPO_PUBLIC_)/.test(key)) continue;
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      env[key] = value;
    }
  } catch {
    /* ignore missing/unreadable .env */
  }
  return env;
}

const DOT_ENV = loadDotEnv();

module.exports = function importMetaEnvForHermes({ types: t }) {
  function isImportMeta(node) {
    return t.isMetaProperty(node) && node.meta.name === 'import' && node.property.name === 'meta';
  }

  function processEnv() {
    return t.memberExpression(t.identifier('process'), t.identifier('env'));
  }

  function isImportMetaEnvMember(node) {
    return (
      t.isMemberExpression(node) &&
      isImportMeta(node.object) &&
      t.isIdentifier(node.property, { name: 'env' })
    );
  }

  function isProcessEnvMember(node) {
    return (
      (t.isMemberExpression(node) || t.isOptionalMemberExpression(node)) &&
      t.isMemberExpression(node.object) &&
      t.isIdentifier(node.object.object, { name: 'process' }) &&
      t.isIdentifier(node.object.property, { name: 'env' })
    );
  }

  function envKeyFromMember(node) {
    if (t.isIdentifier(node.property) && !node.computed) return node.property.name;
    if (t.isStringLiteral(node.property)) return node.property.value;
    return null;
  }

  function inlineEnvValue(key) {
    if (!key || !/^(VITE_|EXPO_PUBLIC_)/.test(key)) return null;
    if (Object.prototype.hasOwnProperty.call(process.env, key) && process.env[key] !== undefined) {
      return String(process.env[key]);
    }
    if (Object.prototype.hasOwnProperty.call(DOT_ENV, key)) {
      return String(DOT_ENV[key]);
    }
    return null;
  }

  function rewritePath(pathNode) {
    const { node } = pathNode;

    // import.meta.env.KEY → literal (or process.env.KEY)
    if (
      (t.isMemberExpression(node) || t.isOptionalMemberExpression(node)) &&
      isImportMetaEnvMember(node.object)
    ) {
      const key = envKeyFromMember(node);
      const value = inlineEnvValue(key);
      if (value !== null) {
        pathNode.replaceWith(t.stringLiteral(value));
        return;
      }
      node.object = processEnv();
      return;
    }

    if (isImportMetaEnvMember(node)) {
      pathNode.replaceWith(processEnv());
      return;
    }

    // process.env.KEY → literal for public env keys
    if (isProcessEnvMember(node)) {
      const key = envKeyFromMember(node);
      const value = inlineEnvValue(key);
      if (value !== null) {
        pathNode.replaceWith(t.stringLiteral(value));
      }
    }
  }

  return {
    name: 'import-meta-env-for-hermes',
    visitor: {
      MemberExpression: rewritePath,
      OptionalMemberExpression: rewritePath,
      UnaryExpression(pathNode) {
        if (pathNode.node.operator === 'typeof' && isImportMeta(pathNode.node.argument)) {
          pathNode.replaceWith(t.stringLiteral('object'));
        }
      },
      MetaProperty(pathNode) {
        if (!isImportMeta(pathNode.node)) return;
        const parent = pathNode.parentPath;
        if (parent.isMemberExpression({ object: pathNode.node })) return;
        if (parent.isOptionalMemberExpression({ object: pathNode.node })) return;
        pathNode.replaceWith(processEnv());
      },
    },
  };
};
