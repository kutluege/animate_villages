// Serbest kip arayüzü: saat, tod kaydırıcısı, gündüz/gece, filmi oynat.
// Render kipinde hiç oluşturulmaz.
import './ui.css';

const fmt = (tod) => {
  const m = Math.round((((tod % 24) + 24) % 24) * 60) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

/**
 * @param {{onTod:(tod:number)=>void, onDayNight:()=>void, onFilm:()=>void}} handlers
 */
export function createUI(handlers) {
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  };

  const root = el('div', 'mk-ui');
  const clock = el('div', 'mk-clock', '15:00');
  const slider = el('input', 'mk-slider');
  slider.type = 'range';
  slider.min = '0';
  slider.max = '24';
  slider.step = '0.01';
  slider.setAttribute('aria-label', 'Günün saati');
  const dayNight = el('button', 'mk-btn', 'Gece');
  const film = el('button', 'mk-btn mk-primary', 'Filmi oynat');
  const progress = el('div', 'mk-progress');
  const bar = el('i');
  progress.append(bar);
  root.append(clock, slider, dayNight, film, progress);

  const status = el('div', 'mk-status');
  document.body.append(root, status);

  slider.addEventListener('input', () => handlers.onTod(parseFloat(slider.value)));
  dayNight.addEventListener('click', () => handlers.onDayNight());
  film.addEventListener('click', () => handlers.onFilm());

  let lastClock = '';
  return {
    /** Her karede çağrılır; yalnız değişeni DOM'a yazar. */
    sync({ tod, night, filming, progress: p }) {
      const c = fmt(tod);
      if (c !== lastClock) {
        clock.textContent = c;
        lastClock = c;
      }
      if (Math.abs(parseFloat(slider.value) - tod) > 0.004) slider.value = String(tod);
      slider.disabled = !!filming;
      dayNight.disabled = !!filming;
      dayNight.textContent = night > 0.5 ? 'Gündüz' : 'Gece';
      film.textContent = filming ? 'Serbest kamera' : 'Filmi oynat';
      film.classList.toggle('mk-primary', !filming);
      root.classList.toggle('mk-film', !!filming);
      bar.style.width = `${Math.round((p || 0) * 1000) / 10}%`;
    },
    setStatus(lines) {
      status.textContent = lines.join('\n');
    },
  };
}
