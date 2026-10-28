const {createServer} = require('./server/http.cjs');

async function start(environment = process.env) {
  const production = environment.NODE_ENV === 'production';
  const port = Number(environment.PORT || environment.HANDBOOK_PORT || (production ? 3000 : 4188));
  const host = environment.HOST || (production ? '0.0.0.0' : '127.0.0.1');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('PORT 必须是有效端口。');
  const server = await createServer({environment});
  server.on('error', error => { console.error(`权益手册服务启动失败：${error.code || 'SERVER_ERROR'}`); process.exitCode = 1; });
  server.listen(port, host, () => console.log(`权益手册服务已启动，端口 ${port}`));
  const shutdown = () => {
    server.close(() => { process.exitCode = 0; });
    server.closeIdleConnections();
    const timer = setTimeout(() => { server.closeAllConnections(); }, 10000);
    timer.unref();
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
  return server;
}

if (require.main === module) start().catch(error => {
  // Never log connection exceptions, which may include private configuration.
  console.error(error.configuration ? error.message : '权益手册服务启动失败，请检查配置和数据库连接。');
  process.exitCode = 1;
});

module.exports = {createServer, start};
