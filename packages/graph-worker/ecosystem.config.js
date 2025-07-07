module.exports = {
  apps: [
    {
      name: 'graph-worker',
      script: 'dist/index.js',
      cwd: './',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'development',
        PORT: 39111
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 39111
      },
      watch: false,
      max_memory_restart: '1G',
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_file: './logs/pm2-combined.log',
      time: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      log_date_format: 'YYYY-MM-DD HH:mm Z',
      merge_logs: true
    },
    {
      name: 'graph-worker-dev',
      script: 'src/index.ts',
      interpreter: 'tsx',
      cwd: './',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'development',
        PORT: 39111
      },
      watch: ['src'],
      ignore_watch: ['node_modules', 'dist', 'logs', 'backup'],
      max_memory_restart: '1G',
      error_file: './logs/pm2-dev-error.log',
      out_file: './logs/pm2-dev-out.log',
      log_file: './logs/pm2-dev-combined.log',
      time: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      log_date_format: 'YYYY-MM-DD HH:mm Z',
      merge_logs: true
    }
  ]
}; 