// Veri yükleme, coğrafi dönüşüm (CONTRACT §2) ve arazi kotu.

export const DATA_FILES = ['meta', 'buildings', 'roads', 'terrain', 'pois'];
const FALLBACK_ORIGIN = { lat0: 41.0668, lon0: 28.9925 }; // yalnız meta.json yokken

/** web/public/data/*.json — eksik/bozuk dosya null döner, uyarı listesine yazılır. */
export async function loadData(base = '/data/', warnings = []) {
  const data = {};
  await Promise.all(
    DATA_FILES.map(async (name) => {
      data[name] = null;
      try {
        const res = await fetch(`${base}${name}.json`, { cache: 'no-store' });
        const type = res.headers.get('content-type') || '';
        if (!res.ok || !type.includes('json')) throw new Error(`HTTP ${res.status} ${type}`);
        data[name] = await res.json();
      } catch (err) {
        warnings.push(`veri eksik: ${name}.json (${err.message})`);
      }
    }),
  );
  return data;
}

/** Orijin her zaman meta.json'dan; x doğu, z güney (kuzey = −z). */
export function makeGeo(meta) {
  const lat0 = meta?.lat0 ?? FALLBACK_ORIGIN.lat0;
  const lon0 = meta?.lon0 ?? FALLBACK_ORIGIN.lon0;
  const kx = 111320 * Math.cos((lat0 * Math.PI) / 180);
  const kz = 110574;
  return {
    lat0,
    lon0,
    toLocal: (lat, lon) => [(lon - lon0) * kx, -(lat - lat0) * kz],
    toLatLon: (x, z) => [lat0 - z / kz, lon0 + x / kx],
  };
}

/**
 * terrain.json {nx,nz,x0,z0,dx,dz,heights} → heightAt(x,z), bilinear.
 * Satır-öncelikli: heights[iz*nx + ix], x = x0 + ix·dx, z = z0 + iz·dz.
 * Izgara dışında kenara kenetlenir; arazi yoksa 0.
 */
export function makeHeightAt(terrain) {
  const ok =
    terrain && terrain.nx > 1 && terrain.nz > 1 && terrain.dx && terrain.dz &&
    terrain.heights && terrain.heights.length >= terrain.nx * terrain.nz;
  if (!ok) return () => 0;
  const { nx, nz, x0, z0, dx, dz, heights: h } = terrain;
  return (x, z) => {
    let fx = (x - x0) / dx;
    let fz = (z - z0) / dz;
    fx = fx < 0 ? 0 : fx > nx - 1 ? nx - 1 : fx;
    fz = fz < 0 ? 0 : fz > nz - 1 ? nz - 1 : fz;
    const ix = Math.min(Math.floor(fx), nx - 2);
    const iz = Math.min(Math.floor(fz), nz - 2);
    const u = fx - ix;
    const v = fz - iz;
    const i = iz * nx + ix;
    const a = h[i] + (h[i + 1] - h[i]) * u;
    const b = h[i + nx] + (h[i + nx + 1] - h[i + nx]) * u;
    return a + (b - a) * v;
  };
}
