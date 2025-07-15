module.exports = {
  apps: [
    {
      name: 'web-app',
      script: 'next',
      args: 'start -p 39112',
      cwd: './',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 39112
      },
      watch: false,
      max_memory_restart: '1G',
      error_file: './logs/pm2-web-error.log',
      out_file: './logs/pm2-web-out.log',
      log_file: './logs/pm2-web-combined.log',
      time: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      log_date_format: 'YYYY-MM-DD HH:mm Z',
      merge_logs: true
    },
    {
      name: 'web-scheduler',
      script: 'tsx',
      args: 'src/scripts/scheduler.ts',
      cwd: './',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 39112
      },
      watch: false,
      max_memory_restart: '512M',
      error_file: './logs/pm2-scheduler-error.log',
      out_file: './logs/pm2-scheduler-out.log',
      log_file: './logs/pm2-scheduler-combined.log',
      time: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      log_date_format: 'YYYY-MM-DD HH:mm Z',
      merge_logs: true,
      restart_delay: 5000
    }
  ]
}; 