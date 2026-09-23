import { spawn } from 'node:child_process';

function quoteForCmd(arg: string): string {
  return /[\s"]/.test(arg) ? `"${arg.replace(/"/g, '\\"')}"` : arg;
}

/** Runs a command with the terminal attached, resolving on exit code 0. On Windows `npm`
 * and `npx` are `.cmd` shims that Node refuses to spawn without a shell, so there it runs
 * through `cmd.exe` with each argument quoted. stderr is mirrored to the terminal and also
 * captured, so callers can include it in their error. */
export function runProcess(cmd: string, args: readonly string[], cwd?: string): Promise<void> {
  const isWindows = process.platform === 'win32';
  const child = isWindows
    ? spawn([cmd, ...args].map(quoteForCmd).join(' '), {
        cwd,
        shell: true,
        stdio: ['inherit', 'inherit', 'pipe'],
      })
    : spawn(cmd, args, { cwd, stdio: ['inherit', 'inherit', 'pipe'] });

  let stderr = '';
  child.stderr.on('data', (chunk: Buffer) => {
    stderr += chunk.toString();
    process.stderr.write(chunk);
  });

  return new Promise((resolvePromise, reject) => {
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolvePromise();
      else
        reject(new Error(`${cmd} ${args.join(' ')} exited with code ${String(code)}: ${stderr}`));
    });
  });
}
