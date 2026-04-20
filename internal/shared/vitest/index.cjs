const { defineConfig, mergeConfig } = require('vitest/config');

function createConfig(options) {
  return defineConfig(mergeConfig({
    test: {
      testTimeout: 0,
      css: {
        modules: {
          classNameStrategy: 'non-scoped',
        },
      },
      environment: 'happy-dom',
      coverage: {
        reporter: ['html', 'json'],
        provider: 'custom',
        customProviderModule: require.resolve('@vitest/coverage-istanbul'),
        exclude: [
          'coverage/**',
          'dist/**',
          '**/[.]**',
          'packages/*/test?(s)/**',
          '**/*.d.ts',
          '**/virtual:*',
          '**/__x00__*',
          '**/\x00*',
          'cypress/**',
          'test?(s)/**',
          'test?(-*).?(c|m)[jt]s?(x)',
          '**/*{.,-}{test,spec}?(-d).?(c|m)[jt]s?(x)',
          '**/__test?(s)__/**',
          '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*',
          '**/vitest.{workspace,projects}.[jt]s?(on)',
          '**/.{eslint,mocha,prettier}rc.{?(c|m)js,yml}',
          'lib/**',
          'src/locale/**',
          '**/*.stories.tsx',
          '**/__testing__/**',
          '**/*/tailwind.config.ts',
        ],
      },
    },
  }, options));
}

module.exports = createConfig;
