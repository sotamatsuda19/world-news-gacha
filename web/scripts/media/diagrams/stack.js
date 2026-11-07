// Fills every <span class="icon" data-icon="…"> in the s-*.html diagrams, then calls
// Diagram.done() once the small Earth has been drawn.
//   brand icons   icons/*.svg (Simple Icons, CC0): claude, upstash, githubactions, vercel, wikimediacommons
//   "earth"       the app's own WebGL2 Earth (earth-gl.js + earth-2k.jpg)
//   anything else a plain line drawing below
(() => {
  const line = (d) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const GLYPHS = {
    // a jar of saved things
    storage: line('<ellipse cx="12" cy="5.5" rx="7.5" ry="2.8"/><path d="M4.5 5.5v13c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-13"/><path d="M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8"/>'),
    // a page with a folded corner
    page: line('<path d="M6 2.8h8l4.5 4.5v13.9H6z"/><path d="M14 2.8v4.5h4.5"/><path d="M9 12h6.5M9 15.5h6.5"/>'),
    // a die: the draw
    die: line('<rect x="3.5" y="3.5" width="17" height="17" rx="3.5"/><circle cx="8.3" cy="8.3" r="1.1" fill="#111"/><circle cx="12" cy="12" r="1.1" fill="#111"/><circle cx="15.7" cy="15.7" r="1.1" fill="#111"/>'),
    // lines of text being written
    text: line('<path d="M4 6h16M4 10.5h16M4 15h10"/><path d="M17 15.5l3.5-3.5M17 15.5l-.7 2.6 2.6-.7 3.1-3.1"/>'),
    // a folded newspaper
    news: line('<path d="M3.5 5h13v13.5a2 2 0 0 0 2 2H5.5a2 2 0 0 1-2-2z"/><path d="M16.5 9h4v9.5a2 2 0 0 1-4 0"/><path d="M6.5 8.5h7M6.5 12h7M6.5 15.5h4.5"/>'),
  };
  const BRANDS = ["claude", "upstash", "githubactions", "vercel", "wikimediacommons"];

  let earthCanvas = null;
  for (const el of document.querySelectorAll(".icon[data-icon]")) {
    const name = el.dataset.icon;
    if (BRANDS.includes(name)) el.innerHTML = `<img src="icons/${name}.svg" alt="">`;
    else if (name === "earth") earthCanvas = el.appendChild(document.createElement("canvas"));
    else el.innerHTML = GLYPHS[name];
  }

  const imgs = [...document.querySelectorAll(".icon img")].map((i) => i.decode());
  const earth = new Promise((resolve) => {
    if (!earthCanvas) return resolve();
    const img = new Image();
    img.onload = () => {
      const px = Math.round(earthCanvas.parentElement.offsetWidth * devicePixelRatio);
      earthCanvas.width = earthCanvas.height = px;
      const gl = EarthGL.createEarthGL();
      gl.resize(px, px);
      gl.setTexture(img);
      // Africa and Europe, lit from the front so the whole disc shows
      gl.draw(px / 2, px / 2, px / 2 - 1, 18, 14, { lat: 14, lng: 18 });
      earthCanvas.getContext("2d").drawImage(gl.canvas, 0, 0);
      resolve();
    };
    img.src = "earth-2k.jpg";
  });
  Promise.all([...imgs, earth]).then(() => Diagram.done());
})();
