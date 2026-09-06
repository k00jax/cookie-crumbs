// PM2 ecosystem — CHIP static export server (out/ from next build, output: 'export')
// Uses serve.py (SimpleHTTPRequestHandler + immutable cache headers for hashed assets).
module.exports = {
  apps: [
    {
      name: 'chip-static',
      script: 'python3',
      args: '/home/odroid/builds/cookie-crumbs/serve.py',
      cwd: '/home/odroid/builds/cookie-crumbs',
      env: { PORT: '8095', NODE_ENV: 'production' },
      restart_delay: 1000,
      max_restarts: 5,
    },
  ],
};
