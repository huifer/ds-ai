// src/scheduler.mjs
// 内存 cron 调度器 —— 轻量、无依赖、走 setInterval + 时分比对。
//
// 设计动机:
//   - 需求:RSS hub 每天 12:00 北京时间(UTC+8 → 04:00 UTC)触发
//               每日总结每天 23:00 北京时间(UTC+8 → 15:00 UTC)触发
//   - 不引第三方依赖(node-cron),规避 launchd 频繁重启 / Pi 子进程重载下的状态丢失
//   - 用 tickInterval(默认 30s)轮询,够用即可
//   - 任务错过的最大重试窗口 1 小时(超过就跳到次日)
//
// 用法:
//   const sched = createScheduler({ log, tickIntervalMs: 30_000 });
//   sched.register({ id: 'rss-daily', hour: 12, minute: 0, tzOffsetHours: 8, run: async () => {...} });
//   sched.start();
//   sched.stop();  // 优雅退出
const DEFAULT_TICK_MS = 30_000;
const MISSED_GRACE_MS = 60 * 60 * 1000; // 1h 内的错过任务会补跑

export function createScheduler({ log = () => {}, tickIntervalMs = DEFAULT_TICK_MS } = {}) {
  const jobs = []; // { id, hour, minute, tzOffsetHours, lastRunKey, run }
  let timer = null;
  let stopped = false;

  function nowInTz(tzOffsetHours) {
    // 返回目标时区的"今天 YYYY-MM-DD" + "HH:MM"
    const now = new Date();
    const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000;
    const tzMs = utcMs + tzOffsetHours * 3600_000;
    const d = new Date(tzMs);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mi = String(d.getUTCMinutes()).padStart(2, '0');
    return {
      dateKey: `${yyyy}-${mm}-${dd}`,
      hm: `${hh}:${mi}`,
      hh: d.getUTCHours(),
      mi: d.getUTCMinutes(),
      utcMs: tzMs, // 该时区"今天的 00:00 UTC ms" 推算用
    };
  }

  function shouldRun(job) {
    const t = nowInTz(job.tzOffsetHours);
    if (t.hh !== job.hour) return { run: false };
    if (t.mi < job.minute) return { run: false };
    // 同一天同一小时同一分钟内:用 lastRunKey 去重,确保一天只跑一次
    const key = `${job.id}::${t.dateKey}::${t.hh}:${job.minute}`;
    if (job.lastRunKey === key) return { run: false };
    return { run: true, key, dateKey: t.dateKey };
  }

  function tick() {
    if (stopped) return;
    for (const job of jobs) {
      try {
        const r = shouldRun(job);
        if (!r.run) continue;
        job.lastRunKey = r.key;
        log(`[scheduler] 触发 ${job.id} (${r.dateKey} ${job.hour.toString().padStart(2,'0')}:${job.minute.toString().padStart(2,'0')} UTC${job.tzOffsetHours >= 0 ? '+' : ''}${job.tzOffsetHours})`);
        // 不 await,异步执行,异常由 job 自己 log
        Promise.resolve()
          .then(() => job.run({ dateKey: r.dateKey }))
          .catch((e) => log(`[scheduler] ${job.id} 异常:`, e?.message || e));
      } catch (e) {
        log(`[scheduler] ${job.id} 调度异常:`, e?.message || e);
      }
    }
  }

  return {
    register(job) {
      if (!job.id || typeof job.run !== 'function') throw new Error('job 需要 id 和 run()');
      if (typeof job.hour !== 'number' || typeof job.minute !== 'number') {
        throw new Error('job 需要 hour / minute 数字');
      }
      if (typeof job.tzOffsetHours !== 'number') job.tzOffsetHours = 8; // 默认北京时间
      jobs.push({ lastRunKey: null, ...job });
      log(`[scheduler] 注册 ${job.id} @ ${String(job.hour).padStart(2,'0')}:${String(job.minute).padStart(2,'0')} UTC${job.tzOffsetHours >= 0 ? '+' : ''}${job.tzOffsetHours}`);
    },
    list() {
      return jobs.map((j) => ({ id: j.id, hour: j.hour, minute: j.minute, tzOffsetHours: j.tzOffsetHours, lastRunKey: j.lastRunKey }));
    },
    start() {
      if (timer) return;
      stopped = false;
      // 启动立刻 tick 一次(可能补跑刚错过的)
      tick();
      timer = setInterval(tick, tickIntervalMs);
      log(`[scheduler] 启动 tick=${tickIntervalMs}ms, jobs=${jobs.length}`);
    },
    stop() {
      stopped = true;
      if (timer) { clearInterval(timer); timer = null; }
      log(`[scheduler] 已停止`);
    },
  };
}