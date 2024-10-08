// WebGL setup
const canvas = document.getElementById('webglCanvas');
let gl = canvas.getContext('webgl');
if (!gl) {
  alert('WebGL not supported, falling back on experimental-webgl');
  gl = canvas.getContext('experimental-webgl');
}

// Adjust canvas size to window
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
gl.clearColor(0, 0, 0, 1); // Set clear color to black, fully opaque
gl.enable(gl.DEPTH_TEST); // Enable depth testing
gl.depthFunc(gl.LEQUAL); // Near things obscure far things

// Shaders
let vertexShaderSource, fragmentShaderSource;
let program; // Declare program globally
let truckModelData; // Store truck model data
let materialData; // Store material data

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
      const face = parts.slice(1).map(p => {
        const vertexIndices = p.split('/');
        return {
          vertexIndex: parseInt(vertexIndices[0], 10) - 1,
          textureIndex: vertexIndices[1] ? parseInt(vertexIndices[1], 10) - 1 : undefined,
          normalIndex: vertexIndices[2] ? parseInt(vertexIndices[2], 10) - 1 : undefined
        };
      });
      faces.push(face);
    }
  }
  console.log('Model data parsed:', { vertices, normals, textureCoords, faces });
  return { vertices, normals, textureCoords, faces };
}

// Define parseMTL function
function parseMTL(data) {
  const materials = {};
  let currentMaterial = null;

  const lines = data.split('\n');
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);

    if (parts[0] === 'newmtl') {
      currentMaterial = parts[1];
      materials[currentMaterial] = {};
    } else if (currentMaterial) {
      if (parts[0] === 'Kd') {
        materials[currentMaterial].diffuse = parts.slice(1).map(Number);
      } else if (parts[0] === 'Ks') {
        materials[currentMaterial].specular = parts.slice(1).map(Number);
      }
    }
  }

  console.log('Material data parsed:', materials);
  return materials;
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
    return Promise.all([
      fetch('./models/truck/model.obj').then(res => res.text()),  // Truck OBJ file
      fetch('./models/truck/model.mtl').then(res => res.text())   // Truck MTL file
    ]);
  })
  .then(([objData, mtlData]) => {
    truckModelData = parseOBJ(objData);
    materialData = parseMTL(mtlData);
    drawScene(); // Initial render
  })
  .catch((error) => {
    console.error('Error loading resources:', error);
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

  mat4.perspective(projectionMatrix, Math.PI / 4, canvas.width / canvas.height, 0.1, 100.0);
  mat4.translate(viewMatrix, viewMatrix, [0, 0, -10]); // Pull the camera back
  mat4.scale(modelMatrix, modelMatrix, [0.01, 0.01, 0.01]); // Scale down the model if too large

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
  
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  const flattenedVertices = flattenVertices(vertices, faces);

  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(flattenedVertices), gl.STATIC_DRAW);

  const positionLocation = gl.getAttribLocation(program, 'a_position');
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
    for (const vertexData of face) {
      const { vertexIndex } = vertexData;
      if (vertexIndex < 0 || vertexIndex >= vertices.length) {
        console.error(`Invalid vertex index: ${vertexIndex}, skipping this face.`);
        continue; // Skip invalid indices
      }
      flattened.push(...vertices[vertexIndex]);
    }
  }
  return flattened;
}

// Rendering the scene
function drawScene() {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  setupModel(truckModelData);
  gl.drawArrays(gl.TRIANGLES, 0, truckModelData.faces.length * 3);
}

// Utility functions
function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
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
