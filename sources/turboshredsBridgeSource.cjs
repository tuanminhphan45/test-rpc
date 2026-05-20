const { spawn } = require('child_process');
const path = require('path');
const readline = require('readline');
const appConfig = require('../config.cjs');

function startTurboShredsBridgeSource(onTransaction, options = {}) {
  const bridgePath = path.resolve(options.bridgePath || appConfig.turboshreds.bridgePath);
  const addr = options.addr || appConfig.turboshreds.addr;
  const include = options.include || appConfig.turboshreds.include || [];
  const autoRestart = options.autoRestart === true;
  const restartDelayMs = options.restartDelayMs || 5000;

  let child;
  let stopped = false;

  const start = () => {
    child = spawn(bridgePath, [], {
      env: {
        ...process.env,
        TURBOSHREDS_ADDR: addr,
        TURBOSHREDS_INCLUDE: include.join(',')
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const stdoutReader = readline.createInterface({ input: child.stdout });
    stdoutReader.on('line', (line) => {
      if (!line.trim()) return;
      try {
        const tx = JSON.parse(line);
        Promise.resolve(onTransaction(tx)).catch((error) => {
          console.error('[turboshreds-bridge] onTransaction error:', error);
        });
      } catch (error) {
        console.error('[turboshreds-bridge] invalid JSON line:', error.message);
      }
    });

    const stderrReader = readline.createInterface({ input: child.stderr });
    stderrReader.on('line', (line) => {
      console.error(`[turboshreds-bridge] ${line}`);
    });

    child.on('error', (error) => {
      console.error('[turboshreds-bridge] failed to start:', error.message);
    });

    child.on('exit', (code, signal) => {
      stdoutReader.close();
      stderrReader.close();
      console.error(`[turboshreds-bridge] exited code=${code} signal=${signal}`);
      if (autoRestart && !stopped) {
        setTimeout(start, restartDelayMs);
      }
    });

    return child;
  };

  const firstChild = start();
  firstChild.stop = () => {
    stopped = true;
    child?.kill('SIGTERM');
  };

  return firstChild;
}

module.exports = { startTurboShredsBridgeSource };
