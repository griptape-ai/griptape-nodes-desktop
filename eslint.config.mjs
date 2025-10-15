import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import reactPlugin from 'eslint-plugin-react'
import reactHooksPlugin from 'eslint-plugin-react-hooks'
import prettierConfig from 'eslint-config-prettier'

export default [
  // Ignore patterns
  {
    ignores: [
      'node_modules/**',
      '.webpack/**',
      'dist/**',
      'out/**',
      'Releases/**',
      '*.log*',
      '.eslintcache',
      '_*/**' // Dev directories like _userdata, _documents, _logs
    ]
  },
  // Configuration for TypeScript files
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true
        }
      },
      globals: {
        // Node.js globals
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        module: 'readonly',
        require: 'readonly',
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        console: 'readonly'
      }
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      react: reactPlugin,
      'react-hooks': reactHooksPlugin
    },
    rules: {
      // TypeScript recommended rules
      ...tsPlugin.configs.recommended.rules,
      // React recommended rules
      ...reactPlugin.configs.recommended.rules,
      ...reactPlugin.configs['jsx-runtime'].rules,
      // React Hooks rules
      ...reactHooksPlugin.configs.recommended.rules,

      // Custom rule overrides
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_'
        }
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      'react/prop-types': 'off' // TypeScript handles this
    },
    settings: {
      react: {
        version: 'detect'
      }
    }
  },
  // Configuration for JavaScript files (allow CommonJS)
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'script', // Allow CommonJS
        ecmaFeatures: {
          jsx: true
        }
      },
      globals: {
        // Node.js globals
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        module: 'readonly',
        require: 'readonly',
        console: 'readonly'
      }
    },
    plugins: {
      react: reactPlugin
    },
    rules: {
      // React recommended rules for JSX files
      ...reactPlugin.configs.recommended.rules,
      ...reactPlugin.configs['jsx-runtime'].rules,
      'react/prop-types': 'off',
      '@typescript-eslint/no-require-imports': 'off' // Allow require() in JS files
    },
    settings: {
      react: {
        version: 'detect'
      }
    }
  },
  // Configuration for build config files (allow require in TypeScript too)
  {
    files: ['*.config.ts', '*.config.js', 'forge.*.ts', 'webpack.*.ts'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off' // Allow require() in config files
    }
  },
  // Prettier must be last to disable conflicting rules
  prettierConfig
]
