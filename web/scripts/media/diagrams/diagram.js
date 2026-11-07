// Shared helpers of the README's diagram drafts (rendered by make-diagrams.mjs).
//   sky()                      stars on <canvas id="sky">, the same every time
//   wire(a, b, options)        a line from element a to element b on <svg id="wires">
//   done()                     tells the renderer the picture is finished

(function () {
  const W = 1600,
    H = 900;
  let seed = 11;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  function sky(count = 380) {
    const c = document.getElementById("sky");
    c.width = W * 2;
    c.height = H * 2;
    const g = c.getContext("2d");
    g.scale(2, 2);
    g.fillStyle = "#02030a";
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < count; i++) {
      g.fillStyle = `rgba(235,240,255,${0.1 + rand() * 0.45})`;
      g.beginPath();
      g.arc(rand() * W, rand() * H, 0.3 + rand() * 1.0, 0, 7);
      g.fill();
    }
    return g;
  }

  const NS = "http://www.w3.org/2000/svg";
  function svgEl(name, attrs, parent) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    (parent ?? document.getElementById("wires")).appendChild(e);
    return e;
  }

  // The point on a side of an element's box ("left", "right", "top", "bottom"), with
  // an optional offset along that side (-0.5..0.5 of its length).
  function anchor(el, side, along = 0) {
    const r = typeof el === "string" ? document.querySelector(el).getBoundingClientRect() : el.getBoundingClientRect();
    const cx = r.left + r.width / 2 + (side === "top" || side === "bottom" ? along * r.width : 0);
    const cy = r.top + r.height / 2 + (side === "left" || side === "right" ? along * r.height : 0);
    if (side === "left") return { x: r.left, y: cy };
    if (side === "right") return { x: r.right, y: cy };
    if (side === "top") return { x: cx, y: r.top };
    return { x: cx, y: r.bottom };
  }
  const dir = { left: [-1, 0], right: [1, 0], top: [0, -1], bottom: [0, 1] };

  let gradId = 0;
  function wire(a, b, o = {}) {
    const from = o.fromPoint ?? anchor(a, o.from ?? "right", o.fromAlong);
    const to = o.toPoint ?? anchor(b, o.to ?? "left", o.toAlong);
    const k = o.bend ?? Math.max(40, Math.hypot(to.x - from.x, to.y - from.y) * 0.4);
    const d1 = dir[o.from ?? "right"],
      d2 = dir[o.to ?? "left"];
    const path = `M${from.x},${from.y} C${from.x + d1[0] * k},${from.y + d1[1] * k} ${to.x + d2[0] * k},${to.y + d2[1] * k} ${to.x},${to.y}`;
    const color = o.color ?? "#ffd68c";
    const width = o.width ?? 2;
    if (o.glow !== false) svgEl("path", { d: path, fill: "none", stroke: color, "stroke-width": width * 5, "stroke-opacity": 0.08, "stroke-linecap": "round" });
    svgEl("path", {
      d: path,
      fill: "none",
      stroke: color,
      "stroke-width": width,
      "stroke-opacity": o.opacity ?? 0.85,
      "stroke-dasharray": o.dash ?? "none",
      "stroke-linecap": "round",
    });
    if (o.arrow !== false) {
      const [dx, dy] = dir[o.to ?? "left"];
      const s = 7 + width;
      // the arrow points into the box: against the side's outward direction
      const tip = to,
        bx = tip.x + dx * s,
        by = tip.y + dy * s;
      svgEl("path", { d: `M${bx - dy * s * 0.6},${by + dx * s * 0.6} L${tip.x},${tip.y} L${bx + dy * s * 0.6},${by - dx * s * 0.6}`, fill: "none", stroke: color, "stroke-width": width, "stroke-linejoin": "round", "stroke-linecap": "round", "stroke-opacity": o.opacity ?? 0.85 });
    }
    if (o.label) {
      const t = svgEl("text", {
        x: (from.x + to.x) / 2 + (o.labelDx ?? 0),
        y: (from.y + to.y) / 2 + (o.labelDy ?? -10),
        fill: o.labelColor ?? "rgba(238,242,255,0.6)",
        "font-family": "SF Mono, Menlo, monospace",
        "font-size": 12,
        "text-anchor": "middle",
      });
      t.textContent = o.label;
    }
    return path;
  }

  function dot(x, y, r = 4, color = "#fff6df") {
    const id = `g${gradId++}`;
    const defs = svgEl("defs", {});
    const rg = svgEl("radialGradient", { id }, defs);
    svgEl("stop", { offset: "0", "stop-color": color, "stop-opacity": 1 }, rg);
    svgEl("stop", { offset: "1", "stop-color": "#ffd68c", "stop-opacity": 0 }, rg);
    svgEl("circle", { cx: x, cy: y, r: r * 4, fill: `url(#${id})` });
    svgEl("circle", { cx: x, cy: y, r, fill: color });
  }

  window.Diagram = { W, H, rand, sky, wire, anchor, svgEl, dot, done: () => document.fonts.ready.then(() => (window.ready = true)) };
})();
