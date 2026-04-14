import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';

const start = performance.now();
const child = spawn(
  process.env.ComSpec || 'cmd.exe',
  ['/d', '/s', '/c', 'npm run build'],
  {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  },
);

let stdout = '';
let stderr = '';

child.stdout.on('data', (chunk) => {
  const text = chunk.toString();
  stdout += text;
  process.stdout.write(text);
});

child.stderr.on('data', (chunk) => {
  const text = chunk.toString();
  stderr += text;
  process.stderr.write(text);
});

child.on('exit', (code) => {
  const durationMs = Math.round(performance.now() - start);
  const chatMatch =
    stdout.match(/^\s*[├└┌│]?\s*[ƒ○]\s+\/chat\s+([^\r\n]+)/m) ??
    stdout.match(/\/chat\s+([^\r\n]+)/m);
  const middlewareMatch = stdout.match(/^\s*ƒ Middleware\s+([^\r\n]+)/m);

  console.log('\n=== Performance Summary ===');
  console.log(`Build duration: ${durationMs}ms`);
  console.log(`Chat bundle: ${chatMatch?.[1]?.trim() ?? 'unavailable'}`);
  console.log(`Middleware size: ${middlewareMatch?.[1]?.trim() ?? 'unavailable'}`);

  if (stderr.trim()) {
    console.log('\n=== Build stderr ===');
    console.log(stderr.trim());
  }

  process.exit(code ?? 1);
});
