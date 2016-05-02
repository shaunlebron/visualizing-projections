var iso2dproj = (function(){
  var canvas, ctx;
  var width = 800, height = 400;
  var scale = 30;
  var origin = {
    x: width*0.65,
    y: height*0.3,
  };

  var backColor = "#f7f7f7";
  var paperColor = "rgba(0,0,0,0.1)";
  var camColor = "#777";
  var frustumColor = "rgba(0,0,0,0.1)";
  var gridColor = "#FFF";


  // Tango Color Palette
  // http://en.wikipedia.org/wiki/Tango_Desktop_Project#Palette
  var colors = {
    yellow: {light:"#fce94f", medium:"#edd400", dark:"#c4a000", error: "#F00"},
    orange: {light:"#fcaf3e", medium:"#f57900", dark:"#ce5c00", error: "#F00"},
    brown:  {light:"#e9b96e", medium:"#c17d11", dark:"#8f5902", error: "#F00"},
    green:  {light:"#8ae234", medium:"#73d216", dark:"#4e9a06", error: "#F00"},
    blue:   {light:"#729fcf", medium:"#3465a4", dark:"#204a87", error: "#F00"},
    purple: {light:"#ad7fa8", medium:"#75507b", dark:"#5c3566", error: "#F00"},
    red:    {light:"#ef2929", medium:"#cc0000", dark:"#a40000", error: "#F00"},
    white:  {light:"#eeeeec", medium:"#d3d7cf", dark:"#babdb6", error: "#F00"},
    black:  {light:"#888a85", medium:"#555753", dark:"#2e3436", error: "#F00"},
  };

  // from David at http://stackoverflow.com/a/11508164/142317
  function hexToRgb(hex) {

    // strip out "#" if present.
    if (hex[0] == "#") {
      hex = hex.substring(1);
    }

      var bigint = parseInt(hex, 16);
      var r = (bigint >> 16) & 255;
      var g = (bigint >> 8) & 255;
      var b = bigint & 255;

      return r + "," + g + "," + b;
  }

  // Convert 3D space coordinates to flattened 2D isometric coordinates.
  // x and y coordinates are oblique axes separated by 120 degrees.
  // h,v are the horizontal and vertical distances from the origin.
  function spaceToIso(spacePos) {
    var z = (spacePos.z == undefined) ? 0 : spacePos.z;

    var x = spacePos.x + z;
    var y = spacePos.y + z;

    return {
      x: x,
      y: y,
      h: (x-y)*Math.sqrt(3)/2, // Math.cos(Math.PI/6)
      v: (x+y)/2,              // Math.sin(Math.PI/6)
    };
  }

  // Convert the given 2D isometric coordinates to 2D screen coordinates.
  function isoToScreen(isoPos) {
    return {
      x: isoPos.h * scale + origin.x,
      y: -isoPos.v * scale + origin.y,
    };
  }

  // Convert the given 3D space coordinates to 2D screen coordinates.
  function spaceToScreen(spacePos) {
    //return isoToScreen(spaceToIso(spacePos));
    return {
      x: spacePos.x * scale + origin.x,
      y: -spacePos.y * scale + origin.y,
    };
  }

  var spaceCtx = {
    moveTo: function(s) {
      var p = spaceToScreen(s);
      ctx.moveTo(p.x, p.y);
    },
    lineTo: function(s) {
      var p = spaceToScreen(s);
      ctx.lineTo(p.x, p.y);
    },
    circle: function(s, r) {
      var p = spaceToScreen(s);
      ctx.arc(p.x, p.y, r, 0, Math.PI*2);
    },
  };

  function Cube(dict) {
    this.pos = dict.pos || { x:0, y:0, z:0 };
    this.hue = dict.hue || "blue";
    this.createVertsAndFaces();
  }

  Cube.prototype = {
    createVertsAndFaces: function() {
      this.verts = [
        { x: -1, y: -1, z: -1 },
        { x:  1, y: -1, z: -1 },
        { x: -1, y:  1, z: -1 },
        { x:  1, y:  1, z: -1 },
        { x: -1, y: -1, z:  1 },
        { x:  1, y: -1, z:  1 },
        { x: -1, y:  1, z:  1 },
        { x:  1, y:  1, z:  1 },
      ];
      this.faces = [
        { shade: "medium",  norm: { x:  0, y:  0, z: -1 }, indices: [ 0, 1, 3, 2 ], }, // -z
      ];
    },
    modifyVerts: function(callback) {
      var i,len=this.verts.length;
      for (i=0; i<len; i++) {
        callback(this.verts[i]);
      }
      len = this.faces.length;
      for (i=0; i<len; i++) {
        callback(this.faces[i].norm);
      }
    },
    rotateVerts: function(axisA, axisB, a) {
      var c = Math.cos(a);
      var s = Math.sin(a);
      this.modifyVerts(function(v) {
        var a = v[axisA];
        var b = v[axisB];
        v[axisA] = a*c - b*s;
        v[axisB] = a*s + b*c;
      });
    },
    update: function(dt) {
      this.rotateVerts('x','y', dt*Math.PI/2);
    },
    draw: function() {
      var verts = this.verts;
      var pos = this.pos;
      var hue = this.hue;
      function transform(v) {
        return {
          x: pos.x + v.x,
          y: pos.y + v.y,
          z: pos.z + v.z,
        };
      }
      function drawFace(f) {
        ctx.beginPath();
        spaceCtx.moveTo(transform(verts[f.indices[0]]));
        spaceCtx.lineTo(transform(verts[f.indices[1]]));
        spaceCtx.lineTo(transform(verts[f.indices[2]]));
        spaceCtx.lineTo(transform(verts[f.indices[3]]));
        ctx.closePath();
        ctx.fillStyle = colors[hue][f.shade];
        ctx.fill();
      }
      var i;
      for (i=0; i<1; i++) {
        drawFace(this.faces[i]);
      }
    },
  };

  function Camera(dict) {
    this.camDist = dict.camDist;

    this.screenDist = dict.screenDist;
    this.screenWidth = dict.screenWidth;
    this.screenHeight = dict.screenHeight;

    this.cube = dict.cube;

    this.camPos = {
      x: this.cube.pos.x - this.camDist,
      y: this.cube.pos.y,
      z: this.cube.pos.z,
    };
  }

  Camera.prototype = {
    getPaperCorners: function() {
      var w = this.screenWidth;
      var h = this.screenHeight;
      var x = this.camPos.x + this.screenDist;
      return [
        { x: x, y: this.camPos.y + w/2, z: this.camPos.z + h/2 },
        { x: x, y: this.camPos.y - w/2, z: this.camPos.z + h/2 },
      ];
    },
    drawPaper: function() {
      var corners = this.getPaperCorners();
      ctx.beginPath();
      spaceCtx.moveTo(corners[0]);
      spaceCtx.lineTo(corners[1]);
      ctx.closePath();
      ctx.strokeStyle = paperColor;
      ctx.stroke();
    },
    drawCube: function() {
      var verts = this.cube.verts;
      var pos = this.cube.pos;
      var faces = this.cube.faces;
      var hue = this.cube.hue;
      var camDist = this.camDist;
      var camPos = this.camPos;
      var screenDist = this.screenDist;
      function transform(v) {
        var dx = v.x+camDist;
        var dy = v.y;
        var dz = v.z;
        var dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
        var obj = {
          x: camPos.x + screenDist,
          y: camPos.y + v.y/dist * screenDist,
          z: camPos.z + v.z/dist * screenDist,
        };
        return obj;
      }
      function drawFace(f) {
        var high = {x: 0, y: 0, z: 0};
        var low = {x: 0, y: 0, z: 0};
        var i;
        for (i=0; i<4; i++) {
          var p = transform(verts[f.indices[i]]);
          if (p.y >= high.y) { high = p; }
          if (p.y <= low.y) { low = p; }
        }
        ctx.beginPath();
        spaceCtx.moveTo(high);
        spaceCtx.lineTo(low);
        ctx.strokeStyle = colors[hue][f.shade];
        ctx.lineWidth = 6;
        ctx.stroke();
      }
      var i;
      for (i=0; i<1; i++) {
        drawFace(faces[i]);
      }
    },
    drawCam: function() {
      var corners = this.getPaperCorners();

      var corners = this.getPaperCorners();
      ctx.beginPath();
      var i,len=2;
      for (i=0; i<len; i++) {
        spaceCtx.moveTo(this.camPos);
        spaceCtx.lineTo(corners[i]);
      }
      ctx.strokeStyle = frustumColor;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.beginPath();
      spaceCtx.moveTo(corners[0]);
      spaceCtx.lineTo(corners[1]);
      ctx.strokeStyle = frustumColor;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.beginPath();
      spaceCtx.circle(this.camPos,3);
      ctx.fillStyle = camColor;
      ctx.fill();
    },
    drawRays: function() {
      var angles = [];
      var minAngle = 2*Math.PI;
      var maxAngle = -2*Math.PI;
      var minPt, maxPt;
      var p,angle;
      var x,y;
      for (i=0; i<4; i++) {
        p = this.cube.verts[this.cube.faces[0].indices[i]];
        x = this.camDist + p.x;
        y = p.y;
        angle = Math.atan2(y,x);
        if (angle < minAngle) {
          minAngle = angle;
          minPt = p;
        }
        if (angle > maxAngle) {
          maxAngle = angle;
          maxPt = p;
        }
      }
      ctx.globalAlpha = 0.2;
      ctx.beginPath();
      spaceCtx.moveTo(this.camPos);
      spaceCtx.lineTo(minPt);
      spaceCtx.lineTo(maxPt);
      ctx.closePath();
      ctx.fillStyle = colors[this.cube.hue]["light"];
      ctx.fill();
      ctx.globalAlpha = 1;
    },
    draw: function() {
      this.drawPaper();
      this.drawCam();
      this.drawRays();
      this.drawCube();
    },
  };

  function drawGrid() {
    var step = 1;
    var range = 50;
    ctx.beginPath();
    var x,y;
    for (y=-range; y<=range; y++) {
      spaceCtx.moveTo({x: -range*step, y: y*step, z: 0});
      spaceCtx.lineTo({x: range*step, y: y*step, z: 0});
    }
    for (x=-range; x<=range; x++) {
      spaceCtx.moveTo({x: x*step, y: -range*step, z: 0});
      spaceCtx.lineTo({x: x*step, y: range*step, z: 0});
    }
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // polyfill from http://paulirish.com/2011/requestanimationframe-for-smart-animating/
  (function() {
      var lastTime = 0;
      var vendors = ['ms', 'moz', 'webkit', 'o'];
      for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
          window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
          window.cancelAnimationFrame =
      window[vendors[x]+'CancelAnimationFrame'] || window[vendors[x]+'CancelRequestAnimationFrame'];
      }

      if (!window.requestAnimationFrame)
      window.requestAnimationFrame = function(callback, element) {
          var currTime = new Date().getTime();
          var timeToCall = Math.max(0, 16 - (currTime - lastTime));
          var id = window.setTimeout(function() { callback(currTime + timeToCall); },
              timeToCall);
          lastTime = currTime + timeToCall;
          return id;
      };

  if (!window.cancelAnimationFrame)
      window.cancelAnimationFrame = function(id) {
          clearTimeout(id);
      };
  }());

  var cube, camera;

  var imgCaptions = new Image();
  imgCaptions.src = "img/iso2dproj.png";

  var lastTime;
  function tick(time) {
    var dt = (lastTime == undefined) ? 0 : (time-lastTime)/1000;
    lastTime = time;

    ctx.fillStyle = backColor;
    ctx.fillRect(0,0,width,height);
    drawGrid();

    cube.update(dt);

    camera.draw();
    cube.draw();

    ctx.drawImage(imgCaptions, 0, 0);

    window.requestAnimationFrame(tick);
  }

  var time = 0;
  var dt = 1/10;
  function advance() {
    ctx.fillStyle = backColor;
    ctx.fillRect(0,0,width,height);
    drawGrid();

    cube.update(dt);
    cube.draw();

    camera.draw();

    ctx.drawImage(imgCaptions, 0, 0);
    time += dt;
    requestAnimationFrame(tick);
  }

  window.addEventListener('keyup', function(e) {
    if (e.keyCode == 13) {
      advance();
    }
  });


  function start(canvasId) {
    canvas = document.getElementById(canvasId);
    ctx = canvas.getContext('2d');

    canvas.width = width;
    canvas.height = height;

    cube = new Cube({
      hue: "orange",
    });
    camera = new Camera({
      camDist: 11,
      screenDist: 5,
      screenWidth: 4,
      screenHeight: 2,
      cube: cube,
    });
    window.requestAnimationFrame(tick);
    advance();
  }

  return {
    start: start
  };
})();
