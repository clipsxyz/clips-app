/**
 * Hermes does not support import.meta. Map Vite-style env reads to process.env for Metro bundles.
 */
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

  function rewritePath(path) {
    const { node } = path;

    if (isImportMetaEnvMember(node)) {
      path.replaceWith(processEnv());
      return;
    }

    if (
      (t.isMemberExpression(node) || t.isOptionalMemberExpression(node)) &&
      isImportMetaEnvMember(node.object)
    ) {
      node.object = processEnv();
    }
  }

  return {
    name: 'import-meta-env-for-hermes',
    visitor: {
      MemberExpression: rewritePath,
      OptionalMemberExpression: rewritePath,
      UnaryExpression(path) {
        if (path.node.operator === 'typeof' && isImportMeta(path.node.argument)) {
          path.replaceWith(t.stringLiteral('object'));
        }
      },
      MetaProperty(path) {
        if (!isImportMeta(path.node)) return;
        const parent = path.parentPath;
        if (parent.isMemberExpression({ object: path.node })) return;
        if (parent.isOptionalMemberExpression({ object: path.node })) return;
        path.replaceWith(processEnv());
      },
    },
  };
};
