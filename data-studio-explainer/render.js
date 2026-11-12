// Renders index.html frame by frame to an MP4 (1920x1080).
// Usage: node render.js [out.mp4] [fps] [--stills t1,t2,...  outdir]
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
(async () => {
  const args = process.argv.slice(2);
  const url = 'file://' + path.resolve(__dirname, 'index.html') + '#render';
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.goto(url);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
  if (args[0] === '--stills') {
    const times = args[1].split(',').map(Number);
    for (const t of times) {
      await page.evaluate(t => window.__seek(t), t);
      await page.screenshot({ path: path.join(args[2], `t${String(t).padStart(6, '0')}.png`) });
    }
    await browser.close(); return;
  }
  const out = args[0] || 'data-studio-explainer.mp4';
  const fps = +(args[1] || 30);
  const total = await page.evaluate(() => 114);
  const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const n = Math.round(total * fps);
  for (let f = 0; f <= n; f++) {
    await page.evaluate(t => window.__seek(t), f / fps);
    const buf = await page.screenshot({ type: 'png' });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (f % 300 === 0) console.log(`frame ${f}/${n}`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  await browser.close();
  console.log('wrote', out);
})();
