import createConfig from '@termlnk/shared/vitest';

// `@termlnk/web-server` boots a real Node http server, so it needs the `node`
// environment. happy-dom (the workspace default) applies a same-origin policy
// to `fetch` and would block the test's calls to 127.0.0.1:<port> as
// "Cross-Origin Request Blocked".
//
// `fileParallelism: false` serialises the two spec files because each binds
// a real port; running them in parallel risks EADDRINUSE on collisions in
// the random port range.
export default createConfig({
  test: {
    environment: 'node',
    fileParallelism: false,
  },
});
