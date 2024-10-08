// WebGL setup
const canvas = document.getElementById('webglCanvas');
const gl = canvas.getContext('webgl');
if (!gl) {
  alert('WebGL not supported, falling back on experimental-webgl');
  gl = canvas.getContext('experimental-webgl');
}

console.log('WebGL context initialized');

// Adjust canvas size to window
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
gl.clearColor(0, 0, 0, 1); // Black background
gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
gl.enable(gl.DEPTH_TEST);   // Enable depth testing
gl.depthFunc(gl.LEQUAL);    // Near things obscure far things

gl.disable(gl.CULL_FACE);   // Disable face culling for now

// Explicitly define the viewport to cover the whole canvas
gl.viewport(0, 0, canvas.width, canvas.height);

console.log('Canvas and WebGL settings applied');

// Shader sources
const vertexShaderSource = `
  attribute vec4 a_position;
  uniform mat4 uModelMatrix;
  uniform mat4 uViewMatrix;
  uniform mat4 uProjectionMatrix;
  void main() {
    gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * a_position;
  }
`;

const fragmentShaderSource = `
  precision mediump float;
  varying vec3 vNormal;
  void main() {
    vec3 ambientLight = vec3(0.6, 0.6, 0.6); // Simple ambient lighting
    vec3 color = vec3(1.0, 1.0, 1.0);  // White model color
    gl_FragColor = vec4(color * ambientLight, 1.0);
  }
`;

// Compile shaders and create program
const program = initShaders(gl, vertexShaderSource, fragmentShaderSource);
if (program) {
  console.log('Shader program successfully created');
} else {
  console.error('Shader program creation failed');
}

// Set up transformation matrices
const modelMatrix = mat4.create(), viewMatrix = mat4.create(), projectionMatrix = mat4.create();
mat4.perspective(projectionMatrix, Math.PI / 4, canvas.width / canvas.height, 0.1, 100.0);

// Move the camera closer to ensure the model is in view
mat4.translate(viewMatrix, viewMatrix, [0, 0, -5]);

// Adjust the model scale as needed
mat4.scale(modelMatrix, modelMatrix, [0.1, 0.1, 0.1]);

console.log('Transformation matrices created:', { modelMatrix, viewMatrix, projectionMatrix });

// Load truck OBJ model
console.log('Attempting to load OBJ model...');
fetch('/models/truck/model.obj')
  .then(res => res.text())
  .then(objData => {
    console.log('OBJ model loaded successfully');
    const truckModelData = parseOBJ(objData);
    if (truckModelData.vertices.length > 0) {
      console.log('OBJ model parsed successfully:', truckModelData);
    } else {
      console.error('No vertices found in OBJ model');
    }
    drawScene(truckModelData); // Initial render
  })
  .catch(error => {
    console.error('Error loading model:', error);
  });

// Shader and program initialization functions
function initShaders(gl, vsSource, fsSource) {
  console.log('Initializing shaders');
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vsSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
  const shaderProgram = createProgram(gl, vertexShader, fragmentShader);
  return shaderProgram;
}

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('An error occurred compiling the shader: ' + gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  console.log(`Shader compiled: ${type === gl.VERTEX_SHADER ? 'VERTEX' : 'FRAGMENT'}`);
  return shader;
}

function createProgram(gl, vertexShader, fragmentShader) {
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program linking failed: ' + gl.getProgramInfoLog(program));
    return null;
  }
  console.log('Shader program linked successfully');
  return program;
}

// Parse OBJ data function
function parseOBJ(data) {
  console.log('Parsing OBJ data');
  const vertices = [];
  const faces = [];

  const lines = data.split('\n');
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts[0] === 'v') {
      vertices.push(parts.slice(1).map(Number));
    } else if (parts[0] === 'f') {
      const face = parts.slice(1).map(p => {
        const vertexIndex = parseInt(p.split('/')[0], 10) - 1;
        return vertexIndex;
      });
      faces.push(face);
    }
  }
  console.log(`OBJ parsing complete. Vertices: ${vertices.length}, Faces: ${faces.length}`);
  return { vertices, faces };
}

// Flatten vertices for WebGL buffer
function flattenVertices(vertices, faces) {
  console.log('Flattening vertices for WebGL buffer');
  const flattened = [];
  for (const face of faces) {
    face.forEach(index => {
      flattened.push(...vertices[index]);
    });
  }
  console.log('Vertex flattening complete');
  return flattened;
}

// Rendering the scene
function drawScene(modelData) {
  console.log('Rendering scene');
  const { vertices, faces } = modelData;
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // Setup and bind buffers
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  const flattenedVertices = flattenVertices(vertices, faces);
  console.log(`Flattened vertex count: ${flattenedVertices.length / 3}`);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(flattenedVertices), gl.STATIC_DRAW);

  const positionLocation = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);

  gl.useProgram(program);
  gl.uniformMatrix4fv(gl.getUniformLocation(program, 'uModelMatrix'), false, modelMatrix);
  gl.uniformMatrix4fv(gl.getUniformLocation(program, 'uViewMatrix'), false, viewMatrix);
  gl.uniformMatrix4fv(gl.getUniformLocation(program, 'uProjectionMatrix'), false, projectionMatrix);

  console.log('Drawing the model');
  gl.drawArrays(gl.TRIANGLES, 0, flattenedVertices.length / 3);
  console.log('Rendering complete');
}
