// The Earth as a sphere, drawn by WebGL2 into its own (offscreen) canvas at the
// screen's resolution: smooth even close up, and cheap (one triangle, all the work in
// one small fragment shader). Used by the about page's story (lib/about/engine.ts)
// and by the quiet backdrop of the reading pages (components/EarthBackdrop.tsx).
// The caller draws the result onto its own 2D canvas, under its stars and lights.
//
// Browser only. Without WebGL2, `supported` is false and draw() does nothing
// (the caller shows something simpler instead).

export const EARTH_TEXTURE = "/textures/earth-2k.jpg";

const D = Math.PI / 180;

export type EarthGL = {
  supported: boolean;
  canvas: HTMLCanvasElement; // draw this onto the page's canvas after draw()
  setTexture: (img: HTMLImageElement) => void;
  resize: (width: number, height: number) => void; // in device pixels
  // The globe centred at (cx, cy) with radius r (device pixels, y down), longitude
  // `lon` facing us, the view tilted to latitude `tilt`, lit by a sun overhead at `sun`.
  // false if nothing was drawn (no WebGL2, texture not loaded yet, zero size).
  draw: (cx: number, cy: number, r: number, lon: number, tilt: number, sun: { lat: number; lng: number }) => boolean;
  dispose: () => void; // give the GPU memory back now
};

export function createEarthGL(): EarthGL {
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2", { premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: false });
  if (!gl) return { supported: false, canvas, setTexture() {}, resize() {}, draw: () => false, dispose() {} };

  const sh = (type: number, source: string) => {
    const o = gl.createShader(type)!;
    gl.shaderSource(o, source);
    gl.compileShader(o);
    if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o) ?? "shader");
    return o;
  };
  const pr = gl.createProgram()!;
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, `#version 300 es
      in vec2 a; void main() { gl_Position = vec4(a, 0.0, 1.0); }`));
  // For each screen pixel inside the disc: which latitude/longitude it shows, the
  // texture there (smoothly sampled), lit by a sun so the far side is night.
  gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, `#version 300 es
      precision highp float;
      uniform sampler2D T; uniform vec2 C; uniform float R, L0, TL, SD, CD, SL, GN, HH;
      out vec4 o;
      const float PI = 3.14159265;
      void main() {
        vec2 fc = vec2(gl_FragCoord.x, HH - gl_FragCoord.y);
        float nx = (fc.x - C.x) / R, ny = -(fc.y - C.y) / R, r2 = nx * nx + ny * ny;
        if (r2 > 1.0) { o = vec4(0.0); return; }
        float rho = sqrt(r2), cosc = sqrt(1.0 - r2), sp = sin(TL), cp = cos(TL);
        float lat = asin(clamp(cosc * sp + ny * cp, -1.0, 1.0));
        float lon = atan(nx, cosc * cp - ny * sp) + L0;
        vec2 uv = vec2(fract((lon + PI) / (2.0 * PI)), (0.5 * PI - lat) / PI);
        // At longitude 180 the texture wraps; take the slope from whichever copy is continuous there.
        vec2 uv2 = vec2(fract(uv.x + 0.5) - 0.5, uv.y);
        bool a = fwidth(uv.x) <= fwidth(uv2.x);
        vec4 t = textureGrad(T, uv, a ? dFdx(uv) : dFdx(uv2), a ? dFdy(uv) : dFdy(uv2));
        float view = 0.16 + max(0.0, dot(vec3(nx, ny, cosc), vec3(-0.55, 0.42, 0.72))) + 0.12 * cosc;
        float c = sin(lat) * SD + cos(lat) * CD * cos(lon - SL);
        float s = (0.07 + 1.05 * clamp((c + 0.08) / 0.22, 0.0, 1.0)) * (0.55 + 0.45 * view) * GN;
        vec3 col = t.rgb * s; col.b = col.b * 1.04 + 4.0 / 255.0;
        float al = clamp((1.0 - rho) * R * 0.9, 0.0, 1.0);
        o = vec4(min(col, vec3(1.0)) * al, al);
      }`));
  gl.linkProgram(pr);
  gl.useProgram(pr);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, "a");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = Object.fromEntries(
    (["C", "R", "L0", "TL", "SD", "CD", "SL", "GN", "HH"] as const).map((k) => [k, gl.getUniformLocation(pr, k)]),
  ) as Record<"C" | "R" | "L0" | "TL" | "SD" | "CD" | "SL" | "GN" | "HH", WebGLUniformLocation | null>;
  let texReady = false;

  return {
    supported: true,
    canvas,
    setTexture(img) {
      gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const an = gl.getExtension("EXT_texture_filter_anisotropic");
      if (an) gl.texParameterf(gl.TEXTURE_2D, an.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(an.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
      texReady = true;
    },
    resize(width, height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    },
    draw(cx, cy, r, lon, tilt, sun) {
      if (!texReady || !canvas.width || !canvas.height) return false;
      gl.uniform2f(U.C, cx, cy);
      gl.uniform1f(U.R, r);
      gl.uniform1f(U.L0, lon * D);
      gl.uniform1f(U.TL, tilt * D);
      gl.uniform1f(U.SD, Math.sin(sun.lat * D));
      gl.uniform1f(U.CD, Math.cos(sun.lat * D));
      gl.uniform1f(U.SL, sun.lng * D);
      gl.uniform1f(U.GN, 1.05);
      gl.uniform1f(U.HH, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      return true;
    },
    dispose() {
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}
