// WebGL setup
const canvas = document.getElementById('webglCanvas');
const gl = canvas.getContext('webgl');
if (!gl) {
  alert('WebGL not supported, falling back on experimental-webgl');
  gl = canvas.getContext('experimental-webgl');
}

// Adjust canvas size to window
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Shaders
let vertexShaderSource, fragmentShaderSource;
let program; // Declare program globally
let carModelData; // Store car model data

// Define parseOBJ function
function parseOBJ(data) {
  const vertices = [];
  const normals = [];
  const textureCoords = [];
  const faces = [];

  const lines = data.split('\n');
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts[0] === 'v') {
      vertices.push(parts.slice(1).map(Number));
    } else if (parts[0] === 'vn') {
      normals.push(parts.slice(1).map(Number));
    } else if (parts[0] === 'vt') {
      textureCoords.push(parts.slice(1).map(Number));
    } else if (parts[0] === 'f') {
      const face = parts.slice(1).map(p => p.split('/').map(Number));
      faces.push(face);
    }
  }
  return { vertices, normals, textureCoords, faces };
}

// Load shaders and set up WebGL
fetch('./shaders/vertexShader.glsl')
  .then(res => res.text())
  .then(data => {
    vertexShaderSource = data;
    return fetch('./shaders/fragmentShader.glsl');
  })
  .then(res => res.text())
  .then(data => {
    fragmentShaderSource = data;
    setupWebGL(); // Now call setupWebGL once shaders are loaded
  })
  .then(() => {
    // Load the car pack model
    return fetch('./models/CarPack001.obj').then(res => res.text());
  })
  .then((objData) => {
    // Parse the OBJ file and store it
    carModelData = parseOBJ(objData);
    drawScene(); // Initial render
  });

// WebGL setup and rendering logic
function setupWebGL() {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

  if (!vertexShader || !fragmentShader) {
    console.error('Error creating shaders');
    return;
  }

  program = createProgram(gl, vertexShader, fragmentShader);

  if (!program) {
    console.error('Error creating WebGL program');
    return;
  }

  gl.useProgram(program);

  // Set up matrices for 3D transformation using glMatrix
  const modelMatrix = mat4.create();
  const viewMatrix = mat4.create();
  const projectionMatrix = mat4.create();

  // Use glMatrix to set up 3D perspective
  mat4.perspective(projectionMatrix, Math.PI / 4, canvas.width / canvas.height, 0.1, 100.0);
  mat4.translate(viewMatrix, viewMatrix, [0, 0, -5]); // Move camera back

  // Pass matrix data to shaders
  const modelMatrixLocation = gl.getUniformLocation(program, 'uModelMatrix');
  const viewMatrixLocation = gl.getUniformLocation(program, 'uViewMatrix');
  const projectionMatrixLocation = gl.getUniformLocation(program, 'uProjectionMatrix');

  gl.uniformMatrix4fv(modelMatrixLocation, false, modelMatrix);
  gl.uniformMatrix4fv(viewMatrixLocation, false, viewMatrix);
  gl.uniformMatrix4fv(projectionMatrixLocation, false, projectionMatrix);

  // Set the initial color (white)
  const colorLocation = gl.getUniformLocation(program, 'uColor');
  gl.uniform3f(colorLocation, 1.0, 1.0, 1.0); // White initially

  // Color picker event listener
  document.getElementById('colorPicker').addEventListener('input', function (e) {
    const hex = e.target.value;
    const r = parseInt(hex.substr(1, 2), 16) / 255;
    const g = parseInt(hex.substr(3, 2), 16) / 255;
    const b = parseInt(hex.substr(5, 2), 16) / 255;

    // Update the color in the fragment shader
    gl.uniform3f(colorLocation, r, g, b);

    // Redraw the scene with the new color
    drawScene();
  });
}

// Load model data into WebGL buffers
function setupModel(modelData) {
  const { vertices, faces } = modelData;

  // Create buffers for vertices
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  const flattenedVertices = flattenVertices(vertices, faces);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(flattenedVertices), gl.STATIC_DRAW);

  // Bind the vertex position attribute
  const positionLocation = gl.getAttribLocation(program, 'a_position'); // Use the global program variable
  if (positionLocation === -1) {
    console.error('Failed to get attribute location for a_position');
    return;
  }
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);
}

function flattenVertices(vertices, faces) {
  const flattened = [];
  for (const face of faces) {
    for (const vertex of face) {
      const vertexIndex = vertex[0] - 1; // .obj files are 1-based
      flattened.push(...vertices[vertexIndex]);
    }
  }
  return flattened;
}

// Rendering the scene
function drawScene() {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // Draw the car model
  setupModel(carModelData);
  gl.drawArrays(gl.TRIANGLES, 0, carModelData.faces.length * 3);
}

// Utility functions
function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(`Shader compilation failed: ${gl.getShaderInfoLog(shader)}`);
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl, vertexShader, fragmentShader) {
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(`Program linking failed: ${gl.getProgramInfoLog(program)}`);
    return null;
  }
  return program;
}
