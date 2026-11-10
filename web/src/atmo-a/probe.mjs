import { openBrowser, openScene } from '../../../tools/lib-browser.mjs';
const env = await openBrowser();
try {
  const { page } = await openScene(env, { query: { render: '1', w: 540, h: 960, atmo: 'a', atmobench: '1' }, width: 540, height: 960 });
  const r = await page.evaluate(async () => {
    const R = window.__ctx.renderer, rt = window.__atmoA.hdrRT;
    const { DataUtils } = await import('three');
    const count = async (label) => {
      await window.__renderView({ position: [650, 420, 750], target: [0, 20, 0], fov: 40, tod: 21.5, t: 10 });
      const b = new Uint16Array(rt.width * rt.height * 4);
      R.readRenderTargetPixels(rt, 0, 0, rt.width, rt.height, b);
      let n = 0; for (let i = 0; i < b.length; i++) if (Number.isNaN(DataUtils.fromHalfFloat(b[i]))) n++;
      return label + ':' + n;
    };
    const out = [await count('base')];
    return out;
  });
  console.log(JSON.stringify(r));
} finally { await env.close(); }
