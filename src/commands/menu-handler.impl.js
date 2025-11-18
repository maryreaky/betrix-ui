async function handleCommand(env, job) {
try {
  const jobId = job && job.jobId ? job.jobId : (job && job.payload && job.payload.update_id) || null;
  console.log(new Date().toISOString(), 'HANDLE_COMMAND_RECOVERY', { jobId, envKeys: Object.keys(env || {}) });
  return { ok: true, jobId: jobId, note: 'RECOVERY_HANDLER' };
} catch (err) {
  console.error(new Date().toISOString(), 'HANDLE_COMMAND_ERR', err && (err.stack || err.message));
  return { ok: false, error: (err && (err.message || String(err))) || 'unknown' };
}
}

module.exports = { handleCommand };

Object.assign(module.exports,{handleCommand});

