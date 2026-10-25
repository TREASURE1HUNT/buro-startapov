(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas = document.createElement('canvas');
  canvas.className = 'ocean-wave-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);

  const vertexSource = `
    attribute vec2 a_grid;
    uniform mat4 u_viewProjection;
    uniform float u_time;
    varying vec3 v_position;
    varying vec3 v_normal;
    varying float v_height;
    float heightAt(vec2 p, float t) {
      float swell = 0.33 * sin(p.x * 0.40 + t * 0.52 + sin(p.y * 0.22) * 1.35);
      float crossWave = 0.20 * sin(p.y * 0.61 - t * 0.42 + p.x * 0.19);
      float ripple = 0.075 * cos(p.x * 0.73 + p.y * 0.84 - t * 0.68);
      return swell + crossWave + ripple;
    }
    void main() {
      float x = a_grid.x * 12.0;
      float z = a_grid.y * 10.0;
      vec2 p = vec2(x, z);
      float t = u_time;
      float h = heightAt(p, t);
      float e = 0.035;
      float dx = (heightAt(p + vec2(e,0.0),t)-heightAt(p-vec2(e,0.0),t))/(2.0*e);
      float dz = (heightAt(p + vec2(0.0,e),t)-heightAt(p-vec2(0.0,e),t))/(2.0*e);
      v_position = vec3(x,h,z);
      v_normal = normalize(vec3(-dx,1.0,-dz));
      v_height = h;
      gl_Position = u_viewProjection * vec4(v_position,1.0);
    }
  `;
  const fragmentSource = `
    precision mediump float;
    varying vec3 v_position;
    varying vec3 v_normal;
    varying float v_height;
    uniform float u_time;
    void main() {
      vec3 n = normalize(v_normal);
      vec3 lightDir = normalize(vec3(-0.45,0.82,0.60));
      vec3 viewDir = normalize(vec3(0.0,4.2,10.0)-v_position);
      float diffuse = max(dot(n,lightDir),0.0);
      vec3 halfDir = normalize(lightDir+viewDir);
      float specular = pow(max(dot(n,halfDir),0.0),34.0);
      float crest = smoothstep(0.25,0.47,v_height) * (0.55+0.45*sin(v_position.x*1.3+u_time*0.5));
      vec3 deep = vec3(0.035,0.25,0.34);
      vec3 sea = vec3(0.12,0.55,0.65);
      vec3 foam = vec3(0.68,0.91,0.94);
      vec3 color = mix(deep,sea,clamp(0.22+diffuse*0.58+(v_height+0.5)*0.13,0.0,1.0));
      color = mix(color,foam,clamp(specular*0.62+crest*0.24,0.0,0.72));
      float depth = 0.64 + 0.36*smoothstep(-9.0,7.0,v_position.z);
      float rightWeight = 0.34 + 0.66*smoothstep(-5.0,8.0,v_position.x);
      float alpha = (0.24 + diffuse*0.25 + specular*0.35 + crest*0.10) * depth * rightWeight;
      gl_FragColor = vec4(color,alpha);
    }
  `;
  const compile = (gl, type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || 'Ocean shader failed');
    return shader;
  };
  const normalize = v => { const n = Math.hypot(...v) || 1; return v.map(x => x / n); };
  const cross = (a,b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  const dot = (a,b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  function lookAt(eye,target,up) {
    const z=normalize([eye[0]-target[0],eye[1]-target[1],eye[2]-target[2]]), x=normalize(cross(up,z)), y=cross(z,x);
    return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);
  }
  function perspective(fovy,aspect,near,far) {
    const f=1/Math.tan(fovy/2),nf=1/(near-far);
    return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0]);
  }
  function multiply(a,b) {
    const out=new Float32Array(16);
    for(let c=0;c<4;c++)for(let r=0;r<4;r++)out[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];
    return out;
  }
  function fallback() {
    const fallbackCanvas=document.createElement('canvas');fallbackCanvas.className='ocean-wave-canvas';canvas.remove();document.body.prepend(fallbackCanvas);const ctx=fallbackCanvas.getContext('2d');if(!ctx)return;
    const draw=now=>{
      const ratio=Math.min(window.devicePixelRatio||1,1.5),w=innerWidth,h=innerHeight;
      if(fallbackCanvas.width!==Math.round(w*ratio)||fallbackCanvas.height!==Math.round(h*ratio)){fallbackCanvas.width=Math.round(w*ratio);fallbackCanvas.height=Math.round(h*ratio);fallbackCanvas.style.width=w+'px';fallbackCanvas.style.height=h+'px';}
      ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,w,h);
      const time=reduced?0:now*.00022;
      for(let layer=0;layer<13;layer++){
        const base=h*(.42+layer*.047),amp=10+layer*1.7;
        const grad=ctx.createLinearGradient(0,base-amp, w,base+amp);
        grad.addColorStop(0,'rgba(31,145,160,0)');grad.addColorStop(.46,`rgba(24,143,159,${.09+layer*.004})`);grad.addColorStop(.78,'rgba(60,160,183,.22)');grad.addColorStop(1,'rgba(65,88,166,0)');
        ctx.beginPath();for(let x=0;x<=w;x+=5){const y=base+Math.sin(x*.006+time+layer*.31)*amp+Math.cos(x*.012-time*.7+layer*.5)*amp*.31;x?ctx.lineTo(x,y):ctx.moveTo(x,y);}
        ctx.strokeStyle=grad;ctx.lineWidth=1.1+layer*.035;ctx.shadowColor='#3aaebe';ctx.shadowBlur=8;ctx.stroke();
      }
      ctx.shadowBlur=0;if(!reduced)requestAnimationFrame(draw);
    };requestAnimationFrame(draw);
  }
  try {
    const gl=canvas.getContext('webgl',{alpha:true,antialias:true,powerPreference:'low-power'});
    if(!gl)throw new Error('WebGL unavailable');
    const program=gl.createProgram();gl.attachShader(program,compile(gl,gl.VERTEX_SHADER,vertexSource));gl.attachShader(program,compile(gl,gl.FRAGMENT_SHADER,fragmentSource));gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program)||'Ocean program failed');
    gl.useProgram(program);
    const cols=86,rows=62,vertices=[],indices=[];
    for(let y=0;y<=rows;y++)for(let x=0;x<=cols;x++)vertices.push(x/cols*2-1,y/rows*2-1);
    for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const a=y*(cols+1)+x,b=a+cols+1;indices.push(a,b,a+1,b,b+1,a+1);}
    const vb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);
    const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indices),gl.STATIC_DRAW);
    const pos=gl.getAttribLocation(program,'a_grid');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
    const vp=gl.getUniformLocation(program,'u_viewProjection'),tm=gl.getUniformLocation(program,'u_time');
    gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.enable(gl.DEPTH_TEST);gl.clearColor(0,0,0,0);
    const render=now=>{
      const dpr=Math.min(window.devicePixelRatio||1,1.5),w=innerWidth,h=innerHeight;
      const width=Math.round(w*dpr),height=Math.round(h*dpr);
      if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;canvas.style.width=w+'px';canvas.style.height=h+'px';gl.viewport(0,0,width,height);}
      gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      gl.uniformMatrix4fv(vp,false,multiply(perspective(Math.PI/3,width/height,.1,60),lookAt([0,4.2,10],[0,0,0],[0,1,0])));
      gl.uniform1f(tm,reduced?0:now*.00045);gl.drawElements(gl.TRIANGLES,indices.length,gl.UNSIGNED_SHORT,0);
      if(!reduced)requestAnimationFrame(render);
    };requestAnimationFrame(render);
  } catch { fallback(); }

  const revealTargets=document.querySelectorAll('.academy-hero-copy,.workspace-head,.academy-section-heading,.leader-row,.library-project-card');
  const animate=window.anime?.animate;
  let observer;
  if(typeof animate==='function'&&!reduced&&'IntersectionObserver'in window){
    observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){animate(entry.target,{opacity:[0,1],y:[14,0],duration:650,ease:'outCubic'});observer.unobserve(entry.target);}}),{threshold:.08});
  }
  window.BuroMotion={observe(element){if(!observer)return;element.style.opacity='0';observer.observe(element);}};
  revealTargets.forEach(element=>window.BuroMotion.observe(element));
})();
