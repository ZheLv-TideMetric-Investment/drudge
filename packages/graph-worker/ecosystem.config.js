module.exports = {
  apps: [
    {
      name: 'graph-worker',
      script: 'dist/index.js',
      cwd: './',
      instances: 1,
      exec_mode: 'fork',
      // Node.js启动参数 - 启用内存优化
      node_args: [
        '--expose-gc',              // 允许手动垃圾回收
        '--max-old-space-size=2048', // 设置最大堆内存为2GB
        '--max-semi-space-size=128', // 设置新生代内存为128MB
        '--optimize-for-size'        // 优化内存使用
      ],
      env: {
        NODE_ENV: 'production',
        PORT: 39111
      },
      watch: false,
      // 内存重启配置 - 降低阈值，更早重启
      max_memory_restart: '1800M',  // 1.8GB时重启，留出缓冲空间
      // 进程重启配置
      autorestart: true,
      max_restarts: 5,              // 减少重启次数，避免频繁重启
      min_uptime: '30s',            // 增加最小运行时间
      restart_delay: 5000,          // 重启延迟5秒
      // 日志配置
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_file: './logs/pm2-combined.log',
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      // 监控配置
      pmx: true,
      // 内存监控告警
      monitoring: {
        http: true,
        https: false,
        port: 9615
      }
    }
  ]
}; 