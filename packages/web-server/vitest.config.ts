import createConfig from '@termlnk/shared/vitest';

// @termlnk/web-server 启动真实的 Node http server，需要 node 环境（happy-dom 的 fetch
// 套了 same-origin 策略，会把测试中跨向 127.0.0.1:port 的请求 block 成 NetworkError）。
export default createConfig({
  test: {
    environment: 'node',
  },
});
