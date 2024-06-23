import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

/*----LOADERS----*/
const textureLoader = new THREE.TextureLoader();
const loader = new GLTFLoader();

/*----TEXTURES-----*/
const texture = textureLoader.load('./imgs/radice.png');
const textureCyl = textureLoader.load('./imgs/corteccia.jpg');
const textureGr = textureLoader.load('./imgs/old-wood-tree-with-vintage-texture.jpg');
const textureBo = textureLoader.load('./imgs/rampicante.jpg');

/*----PAUSE VARIABLES----*/
var timer_interval
var starting_time
var started = false;
var pause = true

/*----CAMERA VARIABLES----*/
var distance_x = -0.5
var distance_y = 1.5
var distance_z = 2.5
var ctrl = false
/*---- ----*/
var can_start = false
var mute = false
/*----SPHERE VARIABLES----*/
var sphere = null;
var init_position = {x:0, y:0, z:0}
var finish = false
var sphere_material
var contBanane = 0

/*----OTHER MESHES ----*/
var monkey = null
var ground = null;
var obstacles = [];
var bananas = []

/*----KEYS FOR SPHERE MOVES----*/
const keys = {
    left: { pressed: false },
    right: { pressed: false },
    up: { pressed: false },
    down: { pressed: false },
    space: { pressed: false }
};

/*----SOUNDS----*/
var bounce = new Audio('./sounds/jump-boing.mp3');
var sound = new Audio('./sounds/sound.mp3');
sound.loop = true;
sound.volume = 0.3


class Sphere {
    constructor({ mesh, roughness = 1, metalness = 0, velocity = { x: 0, y: 0, z: 0 }, texture = null, dimensions }) {
        this.mesh = mesh;
        this.ray = dimensions.x / 2;
        this.mesh.velocity = velocity;
        this.gravity = -1;
        this.mesh.material.map = texture;
        this.mesh.material.metalness = metalness;
        this.mesh.material.roughness = roughness;
        this.airFriction = 0.98;
        this.restitutionGround = 0.4;
        this.boundingSphere = new THREE.Sphere(this.mesh.position, this.ray);
        this.isGrounded = false;
        sphere_material = this.mesh.material
    }

    update(ground, obstacles) {
        if(!finish){
            this.boundingSphere.set(this.mesh.position, this.ray);
    
            const quaternion = new THREE.Quaternion();
    
            this.mesh.position.x += this.mesh.velocity.x;
            quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), (this.mesh.velocity.z / this.ray));
            this.mesh.quaternion.multiplyQuaternions(quaternion, this.mesh.quaternion);
    
            this.mesh.position.z += this.mesh.velocity.z;
            quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), (-this.mesh.velocity.x / this.ray));
            this.mesh.quaternion.multiplyQuaternions(quaternion, this.mesh.quaternion);
    
            this.applyGravity(ground, obstacles);
            this.applyFriction();
    
            obstacles.forEach((el, index) => {
                let phaseOffset = index * (Math.PI / 4);
                if (el.mesh.rotation.z != 0) {
                    el.mesh.position.y = 3 + Math.sin((performance.now() * 0.002) + phaseOffset) * 2;
                } else if (el.mesh.name.includes("Cylinder")) {
                    if (el.mesh.userData.id == 2) {
                        phaseOffset = (index - 1) * (Math.PI / 4);
                        el.mesh.position.x = 1.5 - Math.sin((performance.now() * 0.002) + phaseOffset);
                    } else {
                        el.mesh.position.x = -1.5 + Math.sin((performance.now() * 0.002) + phaseOffset);
                    }
                } else {
                    el.mesh.position.x = Math.sin((performance.now() * 0.002) + phaseOffset) * 1.5;
                }
                this.checkObstacleCollision(el);
            });

            bananas.forEach((el)=>{
                el.rotation.y += 0.05
                if(this.checkCollision(el) && !el.userData.presa){
                    el.userData.presa = true
                    el.visible = false
                    contBanane ++
                    document.getElementById("t").innerHTML = contBanane+"x"
                }
            })
            
            if(monkey){
                if(this.checkCollision(monkey)){
                    document.getElementById('bananas_eaten').innerHTML=contBanane
                    document.getElementById('finish_time').innerHTML= document.getElementById('timer').innerHTML
                    finish = true
                    document.getElementById("win").style.display = 'block'
                }
            }
        }
        else stop_time()
    }

    applyGravity(ground, obstacles) {
        this.mesh.velocity.y += this.gravity * (1 / 60);

        if (this.checkCollision(ground.mesh) && this.mesh.velocity.y < 0) {  /*----IF THE SPHERE IS FALLING AND COLLIDE WITH GROUND -> THE BALL BOUNCE----*/
            this.mesh.velocity.y *= this.restitutionGround;
            this.mesh.velocity.y = -this.mesh.velocity.y;
            this.mesh.position.y = ground.top + this.ray;
            this.isGrounded = true
        } else {                                                        /*----OTHERWISE THE POSITION IS UPDATED AND SURELY THE SPHERE ISN'T ON THE GROUND----*/
            this.mesh.position.y += this.mesh.velocity.y;
            this.isGrounded = false
        }
    }

    applyFriction() {
        this.mesh.velocity.x *= this.airFriction;
        this.mesh.velocity.y *= this.airFriction;
        this.mesh.velocity.z *= this.airFriction;
    }

    checkCollision(object) {
        const boxObject = new THREE.Box3().setFromObject(object);
        return this.boundingSphere.intersectsBox(boxObject);
    }

    checkObstacleCollision(obstacle) {
        if (this.checkCollision(obstacle.mesh)) {
            
            const pushOutDistance = 0.01; 
            const penetrationX = (this.ray + obstacle.width / 2) - Math.abs(this.mesh.position.x - obstacle.mesh.position.x);
            const penetrationY = (this.ray + obstacle.height / 2) - Math.abs(this.mesh.position.y - obstacle.mesh.position.y);
            const penetrationZ = (this.ray + obstacle.depth / 2) - Math.abs(this.mesh.position.z - obstacle.mesh.position.z);
            
            /*----COLLISION ALONG X-AXIS----*/
            if(penetrationX == Math.min(penetrationX, penetrationY, penetrationZ)){
                if (this.mesh.position.x > obstacle.mesh.position.x) {
                    this.mesh.position.x += penetrationX + pushOutDistance;
                } else {
                    this.mesh.position.x -= penetrationX + pushOutDistance;
                }
                this.mesh.velocity.x = -this.mesh.velocity.x;
            }
            /*----COLLISION ALONG Y-AXIS----*/
            else if(penetrationY == Math.min(penetrationX, penetrationY, penetrationZ)){
                if (this.mesh.position.y > obstacle.mesh.position.y) {
                    this.mesh.position.y += penetrationY + pushOutDistance;
                } else {
                    /*----THE SPHERE IS MOVED ALONG Z IF IS PRESSED ON THE GROUND----*/
                    if(this.isGrounded) {
                        if (this.mesh.position.z > obstacle.mesh.position.z) {
                            this.mesh.position.z += penetrationZ + pushOutDistance;
                        } else {
                            this.mesh.position.z -= penetrationZ + pushOutDistance;
                        }
                    }
                    else
                        this.mesh.position.y -= penetrationY + pushOutDistance;
                }
                this.mesh.velocity.y = -this.mesh.velocity.y;
            }
            /*----COLLISION ALONG Z-AXIS----*/
            else if(penetrationZ == Math.min(penetrationX, penetrationY, penetrationZ)){
                if (this.mesh.position.z > obstacle.mesh.position.z) {
                    this.mesh.position.z += penetrationZ + pushOutDistance;
                } else {
                    this.mesh.position.z -= penetrationZ + pushOutDistance;
                }
                this.mesh.velocity.z = -this.mesh.velocity.z;
            }
        }
    }
}

class Box {
    constructor({ mesh, dimensions, texture = null }) {
        this.mesh = mesh;
        this.width = dimensions.x;
        this.height = dimensions.y;
        this.depth = dimensions.z;
        this.updateSides();
    }

    updateSides() {
        this.right = this.mesh.position.x + this.width / 2;
        this.left = this.mesh.position.x - this.width / 2;
        this.bottom = this.mesh.position.y - this.height / 2;
        this.top = this.mesh.position.y + this.height / 2;
        this.front = this.mesh.position.z + this.depth / 2;
        this.back = this.mesh.position.z - this.depth / 2;
    }
}

class Cylinder {
    constructor({ mesh, dimensions, texture = null }) {
        this.mesh = mesh;
        this.width = dimensions.x;
        this.height = dimensions.y;
        this.depth = dimensions.z;
        this.updateSides();
    }

    updateSides() {
        const box = new THREE.Box3().setFromObject(this.mesh);
        const size = new THREE.Vector3();
        box.getSize(size);

        this.width = size.x;
        this.height = size.y;
        this.depth = size.z;

        this.right = this.mesh.position.x + this.width / 2;
        this.left = this.mesh.position.x - this.width / 2;
        this.bottom = this.mesh.position.y - this.height / 2;
        this.top = this.mesh.position.y + this.height / 2;
        this.front = this.mesh.position.z + this.depth / 2;
        this.back = this.mesh.position.z - this.depth / 2;
    }

    rotateCylinder() {
        const axis = new THREE.Vector3(0, 1, 0);
        const angle = 0.01;
        const quaternion = new THREE.Quaternion().setFromAxisAngle(axis, angle);
        this.mesh.quaternion.multiplyQuaternions(quaternion, this.mesh.quaternion);
        this.updateSides();
    }
}

/*----UPDATE CAMERA POSITION TO FOLLOW THE ARGUMENT----*/
function updateCamera(mesh){
    if(ctrl){
        distance_x = camera.position.x - mesh.position.x
        distance_y = camera.position.y - mesh.position.y
        distance_z = camera.position.z - mesh.position.z
    }
    camera.position.x = mesh.position.x + distance_x;
    camera.position.y = mesh.position.y + distance_y;
    camera.position.z = mesh.position.z + distance_z;
    controls.target.copy(new THREE.Vector3(mesh.position.x, mesh.position.y + 1, mesh.position.z));
}

/*----RESET THE NECESSARY VARIABLES TO RESTART THE GAME----*/
function restart(){
    sphere.mesh.position.copy(init_position)
    sphere.mesh.velocity={x:0,y:0,z:0}
    bananas.forEach((el)=>{
            el.userData.presa = false
            el.visible = true
    })
    contBanane = 0
    document.getElementById("t").innerHTML = contBanane + "x"
    pause = false
    reset()
    started = false
    finish = false
}

/*----INTERRUPT THE TIMER----*/
function stop_time(){
    clearInterval(timer_interval);
}

/*----START THE TIMER----*/
function start_time(){
    starting_time = Date.now();
    timer_interval = setInterval(updateTimer, 10);
}

/*----UPDATE THE TIMER----*/
function updateTimer(){
    var elapsed_time = Date.now() - starting_time;
    var minutes = Math.floor(elapsed_time / 60000);
    var seconds = Math.floor((elapsed_time % 60000) / 1000);
    var milliseconds = elapsed_time % 1000;
    if(milliseconds>10){
        document.getElementById('timer').innerHTML = ('0' + minutes).slice(-2) + ':' + ('0' + seconds).slice(-2) + ':' + (""+milliseconds).slice(0,2);
    }
    else{
        document.getElementById('timer').innerHTML = ('0' + minutes).slice(-2) + ':' + ('0' + seconds).slice(-2) + ':' + ("0"+milliseconds).slice(0,2);
    }
}

/*----STOP THE GAME----*/
function set_pause(){
    if(started){
        stop_time();
        pause = true 
        document.getElementById("pause").style.display = "flex";
    }
}

/*----RESUME THE GAME----*/
function resume(){
    if(pause && started){
        document.getElementById("pause").style.display = "none";
        var tempo_pause = document.getElementById("timer").innerHTML;
        var pause_milliseconds = parseInt(tempo_pause.split(":")[0]) * 60000 +
                                parseInt(tempo_pause.split(":")[1]) * 1000 +
                                parseInt(tempo_pause.split(":")[2]);
        starting_time = Date.now() - pause_milliseconds;
        timer_interval = setInterval(updateTimer, 10);
    }
}

/*----RESET THE TIMER----*/
function reset(){
    stop_time();
    document.getElementById("timer").innerHTML="00:00:00";
}

document.getElementById('restart').onclick = ()=>{
    restart()
    document.getElementById('gameover').style.display = 'none'
    document.getElementById("win").style.display = 'none'
}

document.getElementById('restart_win').onclick = ()=>{
    restart()
    document.getElementById("win").style.display = 'none'
}


window.addEventListener("keydown", (event) => {
    switch (event.code) {
        case 'ArrowLeft': keys.left.pressed = true; break;
        case 'ArrowRight': keys.right.pressed = true; break;
        case 'ArrowUp': keys.up.pressed = true; break;
        case 'ArrowDown': keys.down.pressed = true; break;
        case 'Space': keys.space.pressed = true; break;
        case 'KeyP': 
            set_pause()
            pause = true; break;
        case 'KeyR': 
            resume()
            pause = false; break;
        case 'BracketRight':
            distance_z *= 0.97
            break
        case 'Slash':
            distance_z /= 0.97
            break
        case 'KeyM':
            if(mute){
                sound.muted = false
                bounce.muted = false
                mute = false
            }
            else{
                sound.muted = true
                bounce.muted = true
                mute = true
            }
            break
        case 'Enter':
            camera.position.x = sphere.mesh.position.x + distance_x;
            camera.position.y = sphere.mesh.position.y + distance_y - (sphere.mesh.position.y - sphere.ray - ground.top);
            camera.position.z = monkey.position.z + distance_z;
//                    controls.target.copy(new THREE.Vector3(sphere.mesh.position.x, sphere.mesh.position.y -1, monkey.position.z));
            can_start = false
            document.getElementById("myModal").style.display = 'none'
            pause = false
            sound.play();
            break
        case 'ControlLeft':
            ctrl = true
            break
    }
});

window.addEventListener("keyup", (event) => {
    switch (event.code) {
        case 'ArrowLeft': keys.left.pressed = false; break;
        case 'ArrowRight': keys.right.pressed = false; break;
        case 'ArrowUp': keys.up.pressed = false; break;
        case 'ArrowDown': keys.down.pressed = false; break;
        case 'Space': keys.space.pressed = false; break;
        case 'ControlLeft': ctrl = false; break
    }
});

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
camera.position.set(2, 4, 10);

const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true
});
renderer.shadowMap.enabled = true;
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 1);
document.body.appendChild(renderer.domElement);


const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(256, {
    format: THREE.RGBFormat,
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
    encoding: THREE.sRGBEncoding
});
const cubeCamera = new THREE.CubeCamera(1, 100, cubeRenderTarget);
scene.add(cubeCamera);

const mirrorMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 1,
    roughness: 0,
    envMap: cubeRenderTarget.texture
});


const controls = new OrbitControls(camera, renderer.domElement);

const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.y = 3;
light.position.z = 0;
light.position.x = 3;

/*----THE LIGHT POINTS TO THE CENTER OF THE MAP----*/
const lightTargetObject = new THREE.Object3D();
lightTargetObject.position.set(0, 0, 0);
scene.add(lightTargetObject);
light.target = lightTargetObject;
light.castShadow = true;

// Shadow camera settings
light.shadow.camera.left = -100;
light.shadow.camera.right = 100;
light.shadow.camera.top = 10;
light.shadow.camera.bottom = -10;

/*----OPTIONAL SETTINGS TO IMPROVE SHADOWS QUALITY----*/
light.shadow.camera.near = -1;
light.shadow.camera.far = 10;
light.shadow.mapSize.width = 4096;
light.shadow.mapSize.height = 4096;

scene.add(light);

const spotlight = new THREE.SpotLight(0xffff00, 3);
spotlight.angle = Math.PI/12
spotlight.position.y = 10
spotlight.visible = false
spotlight.castShadow = true
scene.add(spotlight)

renderer.outputEncoding = THREE.sRGBEncoding;

const hdrTextureUrl = new URL('./imgs/xanderklinge_2k.hdr', import.meta.url);
const loaderTex = new RGBELoader();
loaderTex.load(hdrTextureUrl, function (texture) {
    texture.mapping = THREE.EquirectangularReflectionMapping;
//    scene.background = texture;
    scene.environment = texture;
});

var backTex = textureLoader.load('./imgs/sunny-tropical-landscape.jpg')
scene.background = backTex;




loader.load(
    './scenes/scene.gltf',
    function (gltf) {
        scene.add(gltf.scene);
        let i = 1;
        let j = 0;
        gltf.scene.traverse(function (node) {
            if (node.isMesh) {
                const boundingBox = new THREE.Box3().setFromObject(node);
                const dimensions = new THREE.Vector3();
                boundingBox.getSize(dimensions);
                if (node.name == "Sphere") {
                    sphere = new Sphere({
                        mesh: node,
                        roughness: 1,
                        texture: texture,
                        dimensions: dimensions
                    });
             
                    init_position.x = sphere.mesh.position.x
                    init_position.y = sphere.mesh.position.y
                    init_position.z = sphere.mesh.position.z


                } else if (node.name.includes("Box")) {
                    if (node.name == "Box") {
                        ground = new Box({
                            mesh: node,
                            dimensions: dimensions
                        });

                        light.position.z = node.position.z
                        lightTargetObject.position.copy(node.position)
                        

                        node.material.map = textureGr;
                        node.material.color.setRGB(0.3, 0.2, 0.1);
                    } else {
                        obstacles.push(new Cylinder({
                            mesh: node,
                            dimensions: dimensions
                        }));
                        node.material.map = textureBo
                        node.position.z = -i * 5;
                        i++;
                    }
                } else if (node.name.includes("Cylinder")) {
                    obstacles.push(new Cylinder({
                        mesh: node,
                        dimensions: dimensions
                    }));
                    node.position.z = -i * 5;
                    if (node.rotation.z == 0) {
                        if (j == 0) j++;
                        else {
                            i++;
                            j = 0;
                        }
                    } else i++;
                    node.material.map = textureCyl;
                    node.material.color.setRGB(0.3, 0.2, 0.1);
                }
                else if(node.name.includes("Banana")){
                    node.material.color.setRGB(1, 1, 0)
                    node.userData.presa = false
                    if(bananas.length == 0) {
                        node.position.z = obstacles[0].mesh.position.z + 2.5
                    }
                    else {
                        node.position.z = bananas[bananas.length-1].position.z - 5
                    }
                    node.position.x = Math.floor(Math.random()*5-2)
                    node.position.y = Math.floor(Math.random()*5+1)
                    bananas.push(node)
                }
                node.receiveShadow = true;
                node.castShadow = true;
            }
        });

        loader.load(
            './scenes/monkey.gltf',
            function (gltf) {
                scene.add(gltf.scene);
                gltf.scene.scale.x = 0.01
                gltf.scene.scale.y = 0.01
                gltf.scene.scale.z = 0.01
                gltf.scene.position.y += 0.5
                gltf.scene.position.z = -i * 5;
                i++
                monkey = gltf.scene

                document.getElementById("myModal").style.display = 'block'
            },
            undefined,
            (error) => {
                console.error(error);
            }
        );

        ground.mesh.geometry = new THREE.BoxGeometry(ground.width, ground.height, 5 * (i + 2))
        ground.mesh.position.z = 2 + sphere.mesh.position.z - (5 * (i + 2)) / 2

    },
    undefined,
    (error) => {
        console.error(error);
    }
);


function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
    
    if(pause) return
    
    if (!sphere) return;
    
    /*----THE TIMER STARTS WHEN SPHERE MOVES FIRST TIME----*/            
    if(!started && (sphere.mesh.velocity.x != 0 || sphere.mesh.velocity.z != 0 || keys.space.pressed)) {
        start_time()
        started = true
    }
    
    /*----THE SPOTLIGHT FOLLOWS THE SPHERE----*/            
    spotlight.position.z = sphere.mesh.position.z
    spotlight.position.x = sphere.mesh.position.x
    spotlight.target = sphere.mesh
    
    /*----THE CUBE CAMERA FOLLOW THE SPHERE TO REFLECT CORRECTLY----*/            
    cubeCamera.position.copy(sphere.mesh.position);
    cubeCamera.update(renderer, scene);
    
    /*----IF THE SPHERE FALLS DOWN THE MATCH RESTART-----*/
    if(sphere.mesh.position.y < -10) {
        document.getElementById('gameover').style.display = 'block'
        pause = true
        stop_time()
    }
    
    /*----MOVEMENTS-----*/
    if (keys.left.pressed) sphere.mesh.velocity.x -= params.moveSpeed;
    else if (keys.right.pressed) sphere.mesh.velocity.x += params.moveSpeed;

    if (keys.down.pressed) sphere.mesh.velocity.z += params.moveSpeed;
    else if (keys.up.pressed) sphere.mesh.velocity.z -= params.moveSpeed;

    if (keys.space.pressed && sphere.isGrounded ) {
        sphere.mesh.velocity.y = params.jumpStrength;
        bounce.play();
    }

    /*----UPDATE SPHERE POSITION----*/
    sphere.update(ground, obstacles);

    if(can_start){
        /*----UPDATE CAMERA'S POSITION TO FOLLOW THE SPHERE----*/
        updateCamera(sphere.mesh)
    }
    else{
        /*ZOOM-OUT AT THE START OF THE MATCH----*/
        if(camera.position.z<(sphere.mesh.position.z)){
            camera.position.z += (1-(sphere.mesh.position.z - camera.position.z)/(sphere.mesh.position.z - monkey.position.z))
            controls.target.copy(new THREE.Vector3(camera.position.x - distance_x, camera.position.y - distance_y + 1, camera.position.z - distance_z));
        }
        else if(camera.position.z<(sphere.mesh.position.z + distance_z)){
            camera.position.z += 0.05
            controls.target.copy(new THREE.Vector3(camera.position.x - distance_x, camera.position.y - distance_y + 1, camera.position.z - distance_z));
        }
        else
            can_start = true
    }

controls.update();
}

animate();

// GUI Controls
const gui = new dat.GUI();

const params = {
    textureEnabled: true,
    shadowsEnabled: true,
    moveSpeed: 0.01,
    jumpStrength: 0.45,
    restitutionGround: 0.4,
    airFriction: 0.98,
    gravity: -1,
    roughness: 1,
    metalness: 0,
    toggleTexture: function () {
        sphere.mesh.material.map = params.textureEnabled ? texture : null;
        sphere.mesh.material.needsUpdate = true;
    },
    toggleShadows: function () {
        light.castShadow = params.shadowsEnabled;
    }
};

gui.add(params, 'textureEnabled').name('Enable Texture').onChange(params.toggleTexture);
gui.add(params, 'shadowsEnabled').name('Enable Shadows').onChange(params.toggleShadows);
gui.add(params, 'moveSpeed', 0.001, 0.05).name('Move Speed');
gui.add(params, 'jumpStrength', 0.1, 1).name('Jump Strength');
gui.add(params, 'restitutionGround', 0, 1).name('Restitution Ground').onChange(value => {
    sphere.restitutionGround = value;
});
gui.add(params, 'airFriction', 0.9, 1).name('Air Friction').onChange(value => {
    sphere.airFriction = value;
});
gui.add(params, 'gravity', -10, 0).name('Gravity').onChange(value => {
    sphere.gravity = value;
});
gui.add(params, 'roughness', 0, 1).name('Roughness').onChange(value => {
    sphere.mesh.material.roughness = value;
});
gui.add(params, 'metalness', 0, 1).name('Metalness').onChange(value => {
    sphere.mesh.material.metalness = value;
});

gui.add({ isMirror: false }, 'isMirror').name('Mirror').onChange((value) => {
    if(value)
        sphere.mesh.material = mirrorMaterial;
    else{
        sphere.mesh.material = sphere_material;
    }
});

gui.add({ SpotLight: false }, 'SpotLight').name('SpotLight').onChange((value) => {
    spotlight.visible = value
});
gui.add({ DirectionalLight: true }, 'DirectionalLight').name('DirectionalLight').onChange((value) => {
    light.visible = value
});
gui.closed = true


