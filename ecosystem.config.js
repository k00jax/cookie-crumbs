// PM2 ecosystem — CHIP static export server (out/ from next build, output: 'export')
// Serves the client-only app; all data comes from CORS-open cookiescan APIs in the browser.
module.exports = {
  apps: [
    {
      name: 'chip-static',
      script: 'python3',
      args: '-m http.server 8095 --bind 0.0.0.0 --directory /home/odroid/builds/cookie-crumbs/out',
      cwd: '/home/odroid/builds/cookie-crumbs',
      env: { NODE_ENV: 'production' },
      restart_delay: 1000,
      max_restarts: 5,
    },
  ],
};
