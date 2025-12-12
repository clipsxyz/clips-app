{
  "extends": [
    "eslint:recommended",
    "@typescript-eslint/recommended",
    "plugin:react-hooks/recommended"
  ],
  "parser": "@typescript-eslint/parser",
  "plugins": ["react-refresh"],
  "rules": {
    "react-refresh/only-export-components": [
      "warn",
      { "allowConstantExport": true }
    ],
    "@typescript-eslint/no-explicit-any": "off"
  },
  "ignorePatterns": [
    "src/screens/**/*"
  ],
  "overrides": [
    {
      "files": ["src/screens/**/*.tsx", "src/screens/**/*.ts"],
      "parserOptions": {
        "ecmaFeatures": {
          "jsx": true
        }
      },
      "rules": {
        "@typescript-eslint/no-explicit-any": "off",
        "react-refresh/only-export-components": "off",
        "@typescript-eslint/ban-ts-comment": "off"
      }
    }
  ]
}
