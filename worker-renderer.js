// worker-renderer.js
let canvas, gl, ctx2d, isWebGL2=false, w=0, h=0, dpr=1;
let program=null;
let posBuf=null, colBuf=null, sizeBuf=null;
let a_position=0, a_color=1, a_pointSize=2;

function createShader(gl, type, src){ const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if(!gl.getShaderParameter(s, gl.COMPILE_STATUS)){ const err = gl.getShaderInfoLog(s); gl.deleteShader(s); throw new Error('Shader compile error: '+err); } return s; }

function initGL(canvasEl){ gl = canvasEl.getContext('webgl2') || canvasEl.getContext('webgl'); isWebGL2 = (gl && gl instanceof WebGL2RenderingContext);
 if(!gl){ // fallback to 2D
   ctx2d = canvasEl.getContext('2d'); return;
 }
 // simple point shader
 const vs = `#version 300 es
 in vec2 a_position; in vec3 a_color; in float a_pointSize; uniform vec2 u_resolution; out vec3 v_color; void main(){ vec2 zeroToOne = a_position / u_resolution; vec2 clip = zeroToOne * 2.0 - 1.0; gl_Position = vec4(clip * vec2(1,-1), 0.0, 1.0); gl_PointSize = a_pointSize; v_color = a_color; }`;
 const fs = `#version 300 es
 precision mediump float; in vec3 v_color; out vec4 outColor; void main(){ vec2 p = gl_PointCoord - vec2(0.5); float dist = length(p); if(dist>0.5) discard; outColor = vec4(v_color, 1.0); }
 `;
 const vShader = createShader(gl, gl.VERTEX_SHADER, vs);
 const fShader = createShader(gl, gl.FRAGMENT_SHADER, fs);
 program = gl.createProgram(); gl.attachShader(program, vShader); gl.attachShader(program, fShader); gl.linkProgram(program); if(!gl.getProgramParameter(program, gl.LINK_STATUS)){ throw new Error('Program link error: '+gl.getProgramInfoLog(program)); }
 gl.useProgram(program);
 // buffers
 posBuf = gl.createBuffer(); colBuf = gl.createBuffer(); sizeBuf = gl.createBuffer();
 // attributes
 const stride = 0; const offset = 0;
 a_position = gl.getAttribLocation(program, 'a_position'); a_color = gl.getAttribLocation(program, 'a_color'); a_pointSize = gl.getAttribLocation(program, 'a_pointSize');
 gl.enableVertexAttribArray(a_position); gl.bindBuffer(gl.ARRAY_BUFFER, posBuf); gl.vertexAttribPointer(a_position, 2, gl.FLOAT, false, 0, 0);
 gl.enableVertexAttribArray(a_color); gl.bindBuffer(gl.ARRAY_BUFFER, colBuf); gl.vertexAttribPointer(a_color, 3, gl.FLOAT, false, 0, 0);
 gl.enableVertexAttribArray(a_pointSize); gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuf); gl.vertexAttribPointer(a_pointSize, 1, gl.FLOAT, false, 0, 0);
 gl.viewport(0,0,canvasEl.width,canvasEl.height);
 gl.clearColor(0,0,0,0);
}

self.onmessage = function(e){ const msg = e.data; if(msg.type==='init'){ canvas = msg.canvas; dpr = msg.dpr||1; w = msg.width; h = msg.height; try{ initGL(canvas); }catch(err){ console.error('GL init failed',err); /* fallback to 2D context already set */ } return; }
 if(msg.type==='state'){ const s = msg.state; if(ctx2d){ // draw simple 2D fallback
   const ctx = ctx2d; const width = w, height = h; ctx.clearRect(0,0,width,height);
   // walls
   ctx.fillStyle='#2f1e17'; for(const wall of s.walls){ ctx.fillRect(wall.left*width, wall.top*height, (wall.right-wall.left)*width, (wall.bottom-wall.top)*height); }
   // particles
   for(const p of s.particles){ ctx.fillStyle = p.color; ctx.globalAlpha = Math.max(0,p.life); ctx.fillRect(p.x*width,p.y*height,4,4); }
   // bullets
   for(const b of s.bullets){ ctx.fillStyle = (b.ownerId==='player'?'#ffe35b':'#ff8190'); ctx.beginPath(); ctx.arc(b.x*width,b.y*height,6,0,Math.PI*2); ctx.fill(); }
   // actors
   for(const a of s.actors){ const ax=a.x*width, ay=a.y*height; ctx.fillStyle = a.color; ctx.beginPath(); ctx.arc(ax,ay,28,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#111'; ctx.beginPath(); ctx.arc(ax,ay,16,0,Math.PI*2); ctx.fill(); // hp
     ctx.fillStyle='#2ecc71'; ctx.fillRect(ax-28, ay+22, 28*(a.hp/100), 6); }
   // player
   const p = s.player; if(p.hp>0){ ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x*width,p.y*height,30,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#0b0b0d'; ctx.beginPath(); ctx.arc(p.x*width,p.y*height,18,0,Math.PI*2); ctx.fill(); }
 }
 else if(gl){ // WebGL path
   gl.viewport(0,0,canvas.width,canvas.height);
   gl.clear(gl.COLOR_BUFFER_BIT);
   // Build arrays: positions, colors, sizes
   const total = 1 + s.actors.length + s.bullets.length + s.particles.length;
   const positions = new Float32Array(total*2);
   const colors = new Float32Array(total*3);
   const sizes = new Float32Array(total);
   let idx=0;
   // player
   positions[idx*2]=s.player.x*w; positions[idx*2+1]=s.player.y*h; colors[idx*3]=hexToR(s.player.color); colors[idx*3+1]=hexToG(s.player.color); colors[idx*3+2]=hexToB(s.player.color); sizes[idx]=30.0; idx++;
   // actors
   for(const a of s.actors){ positions[idx*2]=a.x*w; positions[idx*2+1]=a.y*h; colors[idx*3]=hexToR(a.color); colors[idx*3+1]=hexToG(a.color); colors[idx*3+2]=hexToB(a.color); sizes[idx]=28.0; idx++; }
   // bullets
   for(const b of s.bullets){ positions[idx*2]=b.x*w; positions[idx*2+1]=b.y*h; const c = (b.ownerId==='player')? '#ffe35b':'#ff8190'; colors[idx*3]=hexToR(c); colors[idx*3+1]=hexToG(c); colors[idx*3+2]=hexToB(c); sizes[idx]=8.0; idx++; }
   // particles
   for(const p of s.particles){ positions[idx*2]=p.x*w; positions[idx*2+1]=p.y*h; const c = p.color || '#ffd166'; colors[idx*3]=hexToR(c); colors[idx*3+1]=hexToG(c); colors[idx*3+2]=hexToB(c); sizes[idx]=4.0; idx++; }
   // upload
   gl.bindBuffer(gl.ARRAY_BUFFER, posBuf); gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
   gl.enableVertexAttribArray(a_position); gl.vertexAttribPointer(a_position,2,gl.FLOAT,false,0,0);
   gl.bindBuffer(gl.ARRAY_BUFFER, colBuf); gl.bufferData(gl.ARRAY_BUFFER, colors, gl.DYNAMIC_DRAW);
   gl.enableVertexAttribArray(a_color); gl.vertexAttribPointer(a_color,3,gl.FLOAT,false,0,0);
   gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuf); gl.bufferData(gl.ARRAY_BUFFER, sizes, gl.DYNAMIC_DRAW);
   gl.enableVertexAttribArray(a_pointSize); gl.vertexAttribPointer(a_pointSize,1,gl.FLOAT,false,0,0);
   // set uniform resolution
   const u_resolution = gl.getUniformLocation(program, 'u_resolution'); gl.uniform2f(u_resolution, w, h);
   gl.drawArrays(gl.POINTS, 0, idx);
 }
 }
};

// helpers to convert #rrggbb to normalized floats
function hexToR(hex){ const v=parseInt(hex.slice(1,3),16); return v/255; }
function hexToG(hex){ const v=parseInt(hex.slice(3,5),16); return v/255; }
function hexToB(hex){ const v=parseInt(hex.slice(5,7),16); return v/255; }
