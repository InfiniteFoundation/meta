"use strict";

// meta.on("init", function()
// {
// 	var holder = document.createElement("div");
// 	holder.style.cssText = "position: relative; width: 640px; height: 480px;";
// 	document.body.appendChild(holder);

// 	meta.engine.container = holder;
// });

meta.on("preload", function() 
{
	var shader = meta.resources.loadShader({
		id: "sprite",
		vertexShader: [
			"attribute vec3 vertexPos;",
			"attribute vec2 uvCoords;",

			"uniform mat4 modelViewMatrix;",
			"uniform mat4 projMatrix;",

			"varying highp vec2 var_uvCoords;",

			"void main(void) {",
			"	gl_Position = projMatrix * modelViewMatrix * vec4(vertexPos, 1.0);",
			"	var_uvCoords = uvCoords;",
			"}"
		],
		fragmentShader: [
			"varying highp vec2 var_uvCoords;",

			"uniform sampler2D texture;",

			"void main(void) {",
			"	gl_FragColor = texture2D(texture, vec2(var_uvCoords.s, var_uvCoords.t));",
			"}"
		]
	});
	shader.use();

	// texture = meta.new(meta.Texture, "cubetexture.png");

	texture = meta.resources.loadTexture("cubetexture.png");

	var player = meta.new(meta.Sprite, "cubetexture");
	// meta.view.add(player);
});

meta.on("load", function() 
{

	// var shader = new meta.Shader("basic", "./basic.vert", "./basic.frag");
	// shader.remove();

	// console.log("load");

	// // var camera = meta.createCamera();
	// // camera.position(20, 300);
	// // meta.camera = camera;

	// var sprite = meta.createEntity("sprite", "player");
	// sprite.position(200, 300);
	// meta.view.add(sprite);

	// sprite.remove();
});
