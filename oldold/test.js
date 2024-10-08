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
fetch('./shaders/vertexShader.glsl').then(res => res.text()).then(data => vertexShaderSource = data);
fetch('./shaders/fragmentShader.glsl').then(res => res.text()).then(data => {
  fragmentShaderSource = data;
  setupWebGL();
});

let texture;

function setupWebGL() {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
  const program = createProgram(gl, vertexShader, fragmentShader);
  gl.useProgram(program);

  // Look up uniforms and attributes
  const positionLocation = gl.getAttribLocation(program, 'a_position');
  const texCoordLocation = gl.getAttribLocation(program, 'a_texCoord');
  const colorLocation = gl.getUniformLocation(program, 'uColor');
  const textureLocation = gl.getUniformLocation(program, 'uTexture');

  // Create a buffer for positions and bind it
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

  // Create a buffer for texture coordinates
  const texCoordBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    0.0, 0.0,
    1.0, 0.0,
    0.0, 1.0,
    0.0, 1.0,
    1.0, 0.0,
    1.0, 1.0
  ]), gl.STATIC_DRAW);

  // Load the image and create texture
  const image = new Image();
  image.src = './images/car_image.png';  // Ensure this path is correct
  image.onload = function() {
    console.log('Image loaded:', image.width, image.height);  // Log dimensions to verify

    // Create and store texture globally
    texture = gl.createTexture();

    // Bind the texture so the following texture functions will apply to this texture
    gl.bindTexture(gl.TEXTURE_2D, texture);

    // Log to ensure the texture is bound
    console.log('Texture bound:', texture);

    // Set texture parameters for non-power-of-two images
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // Upload the image into the texture
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

    // Calculate aspect ratio to scale the image properly
    const imageAspect = image.width / image.height;
    const canvasAspect = canvas.width / canvas.height;
    let drawWidth, drawHeight;

    if (imageAspect > canvasAspect) {
      // Image is wider than canvas
      drawWidth = canvas.width;
      drawHeight = canvas.width / imageAspect;
    } else {
      // Image is taller than canvas
      drawWidth = canvas.height * imageAspect;
      drawHeight = canvas.height;
    }

    // Center the image
    const offsetX = (canvas.width - drawWidth) / 2;
    const offsetY = (canvas.height - drawHeight) / 2;

    // Set the rectangle to the image's scaled size
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);  // Make sure to bind before setting data
    setRectangle(gl, offsetX, offsetY, drawWidth, drawHeight);

    // Draw the scene after the image has loaded and the texture is ready
    drawScene();
  };

  // Color picker event listener
  document.getElementById('colorPicker').addEventListener('input', function(e) {
    const hex = e.target.value;
    const r = parseInt(hex.substr(1, 2), 16) / 255;
    const g = parseInt(hex.substr(3, 2), 16) / 255;
    const b = parseInt(hex.substr(5, 2), 16) / 255;
    gl.uniform3f(colorLocation, r, g, b);
    drawScene();
  });

  function drawScene() {
    // Clear canvas before drawing
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Bind position buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // Bind texture coordinates buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.enableVertexAttribArray(texCoordLocation);
    gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);

    // Activate texture unit 0 and bind the texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);

    // Log to verify texture binding before drawing
    console.log('Drawing with texture:', texture);

    // Tell the shader to use texture unit 0 for uTexture
    gl.uniform1i(textureLocation, 0);

    // Draw the rectangle (6 vertices for 2 triangles)
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
}

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Shader compilation failed', gl.getShaderInfoLog(shader));
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
    console.error('Program linking failed', gl.getProgramInfoLog(program));
    return null;
  }
  return program;
}

function setRectangle(gl, x, y, width, height) {
  const x1 = x;
  const x2 = x + width;
  const y1 = y;
  const y2 = y + height;

  // Ensure this is bound to the position buffer
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    x1, y1,   // First triangle
    x2, y1,
    x1, y2,
    x1, y2,   // Second triangle
    x2, y1,
    x2, y2,
  ]), gl.STATIC_DRAW);
}
