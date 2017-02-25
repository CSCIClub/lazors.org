const static_root = "static/spacegame/";

const BOUNDRY_RADIUS = 2000;
const state = {
  started: false,
  nameChosen: false,
  playerDead: false,
  canRespawn: false,
  myID: 0,
  myName: '',
  players: {},
  tagDivs: {},
  lastState: {},
  toastQueue: [],
  playerIDs: {},
  connected: false,
  connectionAccepted: false,
  respawning: false,
  shotsFired: {}
};

socket = new WebSocket("ws://" + window.location.host + "/spacegame/");
socket.onmessage = function(e) {
  var data = JSON.parse(e.data);
  switch (data.type) {
    case "connection accepted":
      state.myID = data.player_state.id;
      state.connectionAccepted = true;
      break;
    case "player connect":
      state.toastQueue.push(data.player + ' connected');
      setTimeout(function() {
        state.toastQueue.shift();
      }, 5000);
      break;
    case "player disconnect":
      state.toastQueue.push(data.player + ' disconnected');
      setTimeout(function() {
        state.toastQueue.shift();
      }, 5000);
      break;
    case "update":

      for (var id in data.gamestate.shotsFiredMessage) {
        if (!state.shotsFired[id]) {
          receiveShotInfo(data.gamestate.shotsFiredMessage[id]);
          state.shotsFired[id] = true;
          setTimeout(function() {
            delete state.shotsFired[id];
          }, 1000);
        }
      }
      updatePlayers(data.gamestate.players);
      state.lastState = data.gamestate;
      break;
  }
};
socket.onopen = function() {
  state.connected = true;
};

// Call onopen directly if socket is already open
if (socket.readyState == WebSocket.OPEN) socket.onopen();

function updatePlayers(playerJSON) {
  for (var id in state.playerIDs) {
    state.playerIDs[id] = false;
  }
  for (var id in playerJSON) {
    if (id == state.myID && state.started) continue;
    else if (id == state.myID && (state.connectionAccepted || state.respawning)) {
      player.getObject()
        .position.set(
          playerJSON[id].position.x,
          playerJSON[id].position.y,
          playerJSON[id].position.z
        );
      state.started = true;
      if (state.respawning) {
        state.respawning = false;
        state.started = true;
      }
    }

    if (id == state.myID) {
      continue;
    }
    if (state.playerIDs[id] == null) {
      state.playerIDs[id] = true;
      state.players[id] = new THREE.Object3D;
      state.players[id] = createPlayer(
        playerJSON[id].position.x,
        playerJSON[id].position.y,
        playerJSON[id].position.z,
        id,
        0
      );

      //calculate 2d coords ???
      var width = window.innerWidth,
        height = window.innerHeight;
      var widthHalf = width / 2,
        heightHalf = height / 2;

      var pos = state.players[id].position.clone();
      pos.project(camera);
      pos.x = (pos.x * widthHalf) + widthHalf;
      pos.y = -(pos.y * heightHalf) + heightHalf;

      state.tagDivs[id] = document.createElement('div');
      document.body.appendChild(state.tagDivs[id]);
      state.tagDivs[id].className = 'tag';
      state.tagDivs[id].innerHTML = playerJSON[id].name;

      state.tagDivs[id].left = pos.x;
      state.tagDivs[id].top = pos.y;

      scene.add(state.players[id]);
    } else {
      state.playerIDs[id] = true;

      if (!state.players[id])
        console.log("error: id: " + id + "   players: " + state.players);

      state.players[id].position.set(
        playerJSON[id].position.x,
        playerJSON[id].position.y,
        playerJSON[id].position.z
      );
      state.players[id].rotation.set(
        playerJSON[id].rotation.x,
        playerJSON[id].rotation.y,
        playerJSON[id].rotation.z
      );
      state.players[id].matrixWorldNeedsUpdate = true;
    }
  }
  for (var id in state.playerIDs) {
    if (state.playerIDs[id] === false) {
      scene.remove(state.players[id]);
      state.playerIDs[id] = null;
      state.players[id] = null;
    }
  }
}

function joinGame(player) {
  if (!state.connected) {
    return;
  }
  var message = {};
  var rotation = camera.getWorldRotation();
  message.type = "join";
  message.name = state.myName;
  socket.send(JSON.stringify(message));
}

function sendUpdates(player) {
  if (!state.connected) {
    return;
  }
  var message = {};
  var rotation = camera.getWorldRotation();
  message.type = "update";
  message.player = {};
  message.player.rotation = {};
  message.player.rotation.x = rotation.x;
  message.player.rotation.y = rotation.y;
  message.player.rotation.z = rotation.z;

  message.player.position = {};
  message.player.position.x = player.position.x;
  message.player.position.y = player.position.y;
  message.player.position.z = player.position.z;

  socket.send(JSON.stringify(message));
}

function receiveShotInfo(message) {
  if (message.shooter === state.myID) {
    if (message.hit != null) {
      state.toastQueue.push('You killed ' + state.lastState.players[message.hit]
        ['name']);
      setTimeout(function() {
        state.toastQueue.shift();
      }, 5000);
    }
    return;
  }
  var raycaster = new THREE.Raycaster();
  var laserContainer = new THREE.Object3D();
  var intersects;
  var origin = {};
  origin.x = message.position.x;
  origin.y = message.position.y;
  origin.z = message.position.z;
  if (message.hit != null) {
    var hitposition;
    var direction = new THREE.Vector3();

    if (message.hit == state.myID) {
      hitposition = player.getObject()
        .position;
    } else {
      hitposition = state.players[message.hit].position;
    }
    direction.x = hitposition.x - origin.x;
    direction.y = hitposition.y - origin.y;
    direction.z = hitposition.z - origin.z;

    raycaster.set(origin, direction.normalize());
    intersects = raycaster.intersectObjects(scene.children, true);

    for (var i = 0; i < intersects.length; i++) {
      if (intersects[i].object.material.playerID == message.shooter) continue;
      if (intersects[i].object.material.coltype == "player" || intersects[i].object
        .material.coltype == "laser")
        intersects[i].object.material.color.set(0xff0000);
    }

    //add kill to log
    var killername = state.lastState.players[message.shooter]['name'];
    if (killername === state.myName) killername = "you";
    var victimname = state.lastState.players[message.hit]['name'];
    if (victimname == state.myName) victimname = "you";
    state.toastQueue.push(killername + ' killed ' + victimname);
    setTimeout(function() {
      state.toastQueue.shift();
    }, 5000);
  } else {
    var direction = new THREE.Vector3();
    direction.x = state.players[message.shooter].getWorldDirection.x;
    direction.y = state.players[message.shooter].getWorldDirection.y;
    direction.z = state.players[message.shooter].getWorldDirection.z;
    raycaster.set(origin, direction.normalize());
    intersects = raycaster.intersectObjects(scene.children, true);
    for (var i = 0; i < intersects.length; i++) {
      if (intersects[i].object.material.playerID != message.shooter && (
          intersects[i].object.material.coltype == "player" || intersects[i].object
          .material.coltype == "laser"))
        intersects[i].object.material.color.set(0xff0000);
    }

  }
  laserContainer.rotation.set(
    message.rotation.x,
    message.rotation.y,
    message.rotation.z
  );

  laserContainer.scale.z = message.distance;
  laserContainer.position.set(origin.x, origin.y, origin.z);

  var laserBeam = new THREEx.LaserBeam();
  var object3d = laserBeam.object3d;
  object3d.position.x = 0;
  object3d.position.y = 0;
  object3d.position.z = 0;

  object3d.rotation.x = 0;
  object3d.rotation.y = Math.PI / 2;
  object3d.rotation.z = 0;

  object3d.matrixWorldNeedsUpdate = true;
  laserContainer.add(object3d);

  if (message.distance < 1000) {
    var laserCooked = new THREEx.LaserCooked(laserBeam, laserContainer);
    laserCooked.update();
  }
  scene.add(laserContainer);
  if (message.hit != null) {
    if (message.hit === state.myID) {
      respawn();
    } else {
      resetPlayer(message.hit);
    }
  }

  setTimeout(function() {
    scene.remove(laserContainer);
  }, 200);
}

function sendShotInfo(player, distance, hitID) {
  var message = {};
  message.type = "shoot";
  message.shooter = state.myID;
  message.distance = distance;
  if (hitID && hitID >= 0) {
    message.hit = hitID;
    resetPlayer(hitID);
  }
  var rotation = camera.getWorldRotation();
  message.rotation = {};
  message.rotation.x = rotation.x;
  message.rotation.y = rotation.y;
  message.rotation.z = rotation.z;
  message.position = {};
  message.position.x = player.position.x;
  message.position.y = player.position.y;
  message.position.z = player.position.z;

  socket.send(JSON.stringify(message));
}
var moveDirection = new THREE.Vector3();
var cameraRotation = new THREE.Vector3();
var position = new THREE.Vector3();
var moveSpeed = 10;
var boostSpeed = 400;
var boostMax = 3;
var boostCurrent = boostMax;
var boostdiv = document.getElementById('boostbar');

var onRenderFcts = [];

var center = new THREE.Vector2();

var clock = new THREE.Clock();
var clock2 = new THREE.Clock();
var now, lastShot;
var delta = 0;
var camera, scene, renderer;
var player;

var deathblocker = document.getElementById('deathblocker');
var countdown = document.getElementById('countdown');
var blocker = document.getElementById('blocker');
var instructions = document.getElementById('instructions');
var chooseName = document.getElementById('chooseName');
var nameField = document.getElementById('nameField');
var randomizeButton = document.getElementById('randomizeButton');
var playButton = document.getElementById('playButton');

var leaderboard = document.getElementById('leaderboard');
var plog = document.getElementById('log');
// http://www.html5rocks.com/en/tutorials/pointerlock/intro/

var vowels = 'aeiouy';
var consonants = 'bcdfghjklmnpqrstvwxyz';

var havePointerLock = 'pointerLockElement' in document ||
  'mozPointerLockElement' in document || 'webkitPointerLockElement' in document;

if (havePointerLock) {
  var element = document.body;
  var pointerlockchange = function(event) {
    if (document.pointerLockElement === element || document.mozPointerLockElement ===
      element || document.webkitPointerLockElement === element) {
      if (!state.started)
        joinGame();

      controlsEnabled = true;
      player.enabled = true;
      blocker.style.display = 'none';

    } else {
      controlsEnabled = false;
      player.enabled = false;

      blocker.style.display = '-webkit-box';
      blocker.style.display = '-moz-box';
      blocker.style.display = 'box';
      if (chooseName == false) {
        chooseName.style.display = '';
        instructions.style.display = 'none';
      } else {
        instructions.style.display = '';
        chooseName.style.display = 'none';
      }

    }

  };

  var pointerlockerror = function(event) {
    instructions.style.display = '';
  };

  // Hook pointer lock state change events
  document.addEventListener('pointerlockchange', pointerlockchange, false);
  document.addEventListener('mozpointerlockchange', pointerlockchange, false);
  document.addEventListener('webkitpointerlockchange', pointerlockchange, false);

  document.addEventListener('pointerlockerror', pointerlockerror, false);
  document.addEventListener('mozpointerlockerror', pointerlockerror, false);
  document.addEventListener('webkitpointerlockerror', pointerlockerror, false);

  function randomizeName() {
    var name = "";
    name += consonants[Math.floor(Math.random() * consonants.length)];
    name += vowels[Math.floor(Math.random() * vowels.length)];
    name += consonants[Math.floor(Math.random() * consonants.length)];
    name += consonants[Math.floor(Math.random() * consonants.length)];
    name += vowels[Math.floor(Math.random() * vowels.length)];
    name += consonants[Math.floor(Math.random() * consonants.length)];
    nameField.value = name;
  }

  function playGame() {
    state.nameChosen = true;
    state.myName = nameField.value;
    startGameEvent();
  }

  function startGameEvent(event) {
    if (!state.nameChosen) {
      return;
    }

    if (state.playerDead && state.canRespawn) {
      state.playerDead = false;
      blocker.style.display = 'none';
      askToRespawn();
    }
    instructions.style.display = 'none';
    countdown.style.display = 'none';
    // Ask the browser to lock the pointer
    element.requestPointerLock = (element.requestPointerLock ||
                                  element.mozRequestPointerLock ||
                                  element.webkitRequestPointerLock);
    element.requestPointerLock();
  }

  instructions.addEventListener('click', startGameEvent, false);
  playButton.onclick = playGame;
  randomizeButton.onclick = randomizeName;
  randomizeName();

} else {
  instructions.innerHTML =
    'Your browser doesn\'t seem to support Pointer Lock API';
}

init();
animate();

var controlsEnabled = false;

var boost = false;
var boostLock = false;

var prevTime = performance.now();
var skyBox;

function init() {

  clock2.start();
  lastShot = -5.1;
  now = clock2.getElapsedTime();
  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight,
    1, BOUNDRY_RADIUS * 4);
  center.x = 0;
  center.y = 0;
  scene = new THREE.Scene();
  //scene.fog = new THREE.Fog( 0xffffff, 0, 750 );

  var imagePrefix = static_root;
  var directions = ["px", "nx", "py", "ny", "pz", "nz"];
  var imageSuffix = ".png";
  var skyGeometry = new THREE.CubeGeometry(5000, 5000, 5000);

  var materialArray = [];
  for (var i = 0; i < 6; i++)
    materialArray.push(new THREE.MeshBasicMaterial({
      map: THREE.ImageUtils.loadTexture(imagePrefix + directions[i] +
        imageSuffix),
      side: THREE.BackSide
    }));
  var skyMaterial = new THREE.MeshFaceMaterial(materialArray);
  skyBox = new THREE.Mesh(skyGeometry, skyMaterial);
  scene.add(skyBox);

  var astroidGeometry1 = new THREE.SphereGeometry(1, 3, 3);
  var astroidMesh1 = new THREE.MeshBasicMaterial({
    color: 0x8B7355
  });
  numAstroids = 5000;
  var astroids = new Array(numAstroids);
  for (var i = 0; i < numAstroids; i++) {
    astroids[i] = new THREE.Mesh(
      astroidGeometry1,
      astroidMesh1
    );
    var upper = BOUNDRY_RADIUS;
    var lower = -BOUNDRY_RADIUS;
    var rx = (Math.random() * (upper - lower) + lower);
    var ry = (Math.random() * (upper - lower) + lower);
    var rz = (Math.random() * (upper - lower) + lower);
    astroids[i].position.set(rx, ry, rz);
    scene.add(astroids[i]);
  }

  var plight = new THREE.PointLight(0xffffff, 1, 0);
  plight.position.set(-800, -200, 0);
  var light = new THREE.HemisphereLight(0xeeeeff, 0x777788, 0.75);
  light.position.set(0, 0, 0);
  scene.add(light);
  scene.add(plight);

  player = new THREE.PointerLockControls(camera);

  scene.add(player.getObject());

  var onKeyDown = function(event) {
    if (!state.started || state.playerDead) {
      startGameEvent(event);
    }
    switch (event.keyCode) {
      case 32: // space
        boost = true;
        break;
      case 70: // f
        shoot = true;
        break;
      case 75: //k
        //respawn();
        break;
    }
  };

  var onKeyUp = function(event) {
    switch (event.keyCode) {
      case 32: // spacec
        boost = false;
        break;
    }
  };

  document.addEventListener('keydown', onKeyDown, false);
  document.addEventListener('keyup', onKeyUp, false);

  renderer = new THREE.WebGLRenderer();
  renderer.setClearColor(0x111111);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  window.addEventListener('resize', onWindowResize, false);

  position = player.getObject()
    .position;
  leaderboard.innerHTML = "whatever";
  plog.innerHTML = "whatever";
  leader_list = [];
  state.toastQueue = [];
  audio = new Audio(static_root + 'laser1s.mp3');
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  center.x = 0;
  center.y = 0;
  renderer.setSize(window.innerWidth, window.innerHeight);
}

var r = 0;
var spinspeed = 1;
var counter = 0;
var shoot = false;
var intersects;

raycaster = new THREE.Raycaster();
raycaster.near = 1;
raycaster.far = 1000;

function animate() {
  delta = clock.getDelta();
  requestAnimationFrame(animate);

  if (state.started && !state.playerDead) {
    position = player.getObject()
      .position;
    moveDirection = camera.getWorldDirection();
    cameraRotation = camera.getWorldRotation();

    if (state.started) {
      if (boost && !boostLock) {
        player.getObject()
          .position.set(
            position.x + moveDirection.x * delta * boostSpeed,
            position.y + moveDirection.y * delta * boostSpeed,
            position.z + moveDirection.z * delta * boostSpeed
          );
        boostCurrent -= delta;
        if (boostCurrent < 0) {
          boostCurrent = 0;
          boostLock = true;
          boostdiv.style.backgroundColor = "rgba(255, 0, 0, .5)";
        }
        checkBoundaries();
      } else {
        player.getObject()
          .position.set(
            position.x + moveDirection.x * delta * moveSpeed,
            position.y + moveDirection.y * delta * moveSpeed,
            position.z + moveDirection.z * delta * moveSpeed
          );
        boostCurrent += delta / 2;
        if (boostCurrent > boostMax) {
          boostCurrent = boostMax;
        }
        checkBoundaries();
      }

      position = player.getObject()
        .position;

      skyBox.position.set(
        position.x, position.y, position.z
      );

      //update boost bar
      boostdiv.style.width = ((boostCurrent / boostMax) * 100) + '%';
      if (boostCurrent == boostMax) {
        boostdiv.style.visibility = 'hidden';
        if (boostLock) {
          boostLock = false;
          boostdiv.style.backgroundColor = "rgba(0, 0, 255, .5)";
        }
      } else {
        boostdiv.style.width = ((boostCurrent / boostMax) * 100) + '%';
        boostdiv.style.visibility = 'visible';
      }
    }
    now = clock2.getElapsedTime();
    if (shoot && (now - lastShot) > 0.5 && !boost) {
      lastShot = now;
      playAudio();
      raycaster.setFromCamera(center, camera);
      intersects = raycaster.intersectObjects(scene.children, true);

      for (var i = 0; i < intersects.length; i++) {
        if (intersects[i].object.material.coltype == "player" || intersects[i].object
          .material.coltype == "laser")
          intersects[i].object.material.color.set(0xff0000);
      }
      shoot = false;
      var distance = BOUNDRY_RADIUS * 2;
      var collision = false;
      if (intersects.length > 0) {
        for (var i = 0; i < intersects.length && !collision; i++) {

          if (intersects[i].object.material.coltype == "player") {
            distance = intersects[i].point.distanceTo(raycaster.ray.origin);
            sendShotInfo(player.getObject(), distance, intersects[i].object.material
              .playerID);
            collision = true;
          }
        }
      }

      if (!collision) {
        sendShotInfo(player.getObject(), distance, null);
      }

      var laserContainer = new THREE.Object3D();
      laserContainer.scale.z = distance;
      laserContainer.position.set(
        position.x,
        position.y,
        position.z
      );
      laserContainer.rotation.set(
        cameraRotation.x,
        cameraRotation.y,
        cameraRotation.z
      );
      var laserBeam = new THREEx.LaserBeam();
      var object3d = laserBeam.object3d;
      object3d.position.x = 0;
      object3d.position.y = -0.1;
      object3d.position.z = 0.1;

      object3d.rotation.x = 0;
      object3d.rotation.y = Math.PI / 2;
      object3d.rotation.z = 0;

      object3d.matrixWorldNeedsUpdate = true;
      laserContainer.add(object3d);
      if (distance < 1000) {
        var laserCooked = new THREEx.LaserCooked(laserBeam, laserContainer);
        laserCooked.update();
      }
      scene.add(laserContainer);

      setTimeout(function() {
        scene.remove(laserContainer);
      }, 200);
    }
  }

  if (counter % 5 === 0 && state.started) {
    sendUpdates(player.getObject());
  }
  counter = counter + 1;

  onRenderFcts.forEach(function(updateFn) {
    updateFn();
  });

  //update player log
  plog.innerHTML = state.toastQueue.join("<br/>");

  //update leaderboard
  var leaderboard_list = [];
  if (state.lastState != null) {
    for (var p in state.lastState.players) {
      var cscore = state.lastState.players[p]['score'];
      var cname = state.lastState.players[p]['name'];
      if (cscore >= 0) {
        leaderboard_list.push([cname, cscore]);
      }
    }
  }
  if (leaderboard_list) {
    leaderboard_list = leaderboard_list.sort(function(a, b) {
      return a[1] < b[1];
    });
    let s = "";
    s = "Leaderboard:<table>";
    for (var p in leaderboard_list) {
      s += "<tr><th>" + leaderboard_list[p][0] + "</th><td>" + Math.floor(
        leaderboard_list[p][1]) + "</td></tr>";
    }
    s = s + "</table>";
    leaderboard.innerHTML = s;
  } else {
    leaderboard.innerHTML = "";
  }

  //display player tags
  camera.updateMatrix(); // make sure camera's local matrix is updated
  camera.updateMatrixWorld(); // make sure camera's world matrix is updated
  camera.matrixWorldInverse.getInverse(camera.matrixWorld);

  var frustum = new THREE.Frustum();
  frustum.setFromMatrix(new THREE.Matrix4()
    .multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  for (var id in state.playerIDs) {
    //check if within camera's view:
    let inFieldOfView = frustum.containsPoint(state.players[id].position);
    if (state.players[id] != null && inFieldOfView) {
      state.tagDivs[id].style.visibility = 'visible';

      var width = window.innerWidth,
        height = window.innerHeight;
      var widthHalf = width / 2,
        heightHalf = height / 2;

      var pos = state.players[id].position.clone();
      pos.project(camera);
      pos.x = (pos.x * widthHalf) + widthHalf;
      pos.y = -(pos.y * heightHalf) + heightHalf;

      state.tagDivs[id].style.left = pos.x + 'px';
      state.tagDivs[id].style.top = pos.y - 10 + 'px';
    } else {
      state.tagDivs[id].style.visibility = 'hidden';
    }

  }
  renderer.render(scene, camera);
}

function playAudio() {
  if (audio.paused) {
    audio.play();
  } else {
    audio.currentTime = 0;
  }
}

function checkBoundaries() {
  var newX, newY, newZ;
  var radius = BOUNDRY_RADIUS;
  var offset = 500;
  if (player.getObject()
    .position.x < -radius) {
    newX = radius - offset;
  } else if (player.getObject()
    .position.x > radius) {
    newX = -radius + offset;
  } else {
    newX = 1;
  }

  if (player.getObject()
    .position.y < -radius) {
    newY = radius - offset;
  } else if (player.getObject()
    .position.y > radius) {
    newY = -radius + offset;
  } else {
    newY = 1;
  }

  if (player.getObject()
    .position.z < -radius) {
    newZ = radius - offset;
  } else if (player.getObject()
    .position.z > radius) {
    newZ = -radius + offset;
  } else {
    newZ = 1;
  }

  if (newX * newY * newZ != 1) {
    player.getObject()
      .position.set(newX, newY, newZ);
  }
}

function respawn() {
  state.playerDead = true;
  state.canRespawn = false;
  deathblocker.style.visibility = 'visible';
  countdown.style.display = '';
  blocker.style["background-color"] = 'rgba(0,0,0,1)';
  countdown.innerHTML = 'Respawn in: 3';
  player.getObject()
    .position.set(-11000, -11000, -11000);
  setTimeout(function() {
    countdown.innerHTML = 'Respawn in: 2';
  }, 1000);
  setTimeout(function() {
    countdown.innerHTML = 'Respawn in: 1';
  }, 2000);
  setTimeout(function() {
    countdown.style.display = 'none';
    deathblocker.style.visibility = 'hidden';
    blocker.style.display = '-webkit-box';
    blocker.style.display = '-moz-box';
    blocker.style.display = 'box';
    instructions.style.display = '';
    blocker.style["background-color"] = 'rgba(0,0,0,0.5)';
    state.canRespawn = true;
    state.started = false;
  }, 3000);
}

function askToRespawn() {
  var message = {};
  var rotation = camera.getWorldRotation();
  message.type = "respawn";
  socket.send(JSON.stringify(message));
}

function respawnSuccess() {
  state.respawning = true;
}

function resetPlayer(id) {
  setTimeout(function() {
    if (state.players[id]) {
      state.players[id].position.set(-11000, -11000, -11000);
    }
  }, 100);
  setTimeout(function() {
    if (state.players[id]) {
      state.players[id].children[0].children[0].material.color.set(0x156289);
    }
  }, 2000);
}

function initPlayer() {
  var upper = 10;
  var lower = -10;
  var rx = (Math.random() * (upper - lower) + lower);
  var ry = (Math.random() * (upper - lower) + lower);
  var rz = (Math.random() * (upper - lower) + lower);
  player.getObject()
    .position.set(rx, ry, rz);
}
