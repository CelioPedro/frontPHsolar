import * as THREE from 'three';

const canvas = document.querySelector('#webgl-canvas');
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.set(0, 3, 22);
camera.lookAt(0, 1.5, -10); 

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;


// ==========================================
// 1. O CÉU PROCEDURAL (Sky Dome)
// ==========================================
const skyGeo = new THREE.SphereGeometry(300, 32, 15);
const skyMat = new THREE.ShaderMaterial({
    uniforms: {
        colorTop: { value: new THREE.Color(0x3a8add) },
        colorBottom: { value: new THREE.Color(0xa4d3f5) }
    },
    vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPosition.xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform vec3 colorTop;
        uniform vec3 colorBottom;
        varying vec3 vWorldPosition;
        void main() {
            vec3 dir = normalize(vWorldPosition);
            float t = smoothstep(-0.1, 0.5, dir.y);
            gl_FragColor = vec4(mix(colorBottom, colorTop, t), 1.0);
        }
    `,
    side: THREE.BackSide,
    depthWrite: false
});
const skyDome = new THREE.Mesh(skyGeo, skyMat);
scene.add(skyDome);

scene.fog = new THREE.Fog(0xa4d3f5, 40, 120); 

// ==========================================
// 2. PLACAS (Textura e Geometria)
// ==========================================
function createSolarMaterials() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024; canvas.height = 2048;
    const ctx = canvas.getContext('2d');

    const roughCanvas = document.createElement('canvas');
    roughCanvas.width = 1024; roughCanvas.height = 2048;
    const roughCtx = roughCanvas.getContext('2d');

    // Fundo base (Backsheet branco/prata típico das fotos)
    ctx.fillStyle = '#e8eaed'; 
    ctx.fillRect(0, 0, 1024, 2048);
    roughCtx.fillStyle = 'rgb(200, 200, 200)'; // Fundo difuso (áspero)
    roughCtx.fillRect(0, 0, 1024, 2048);

    const cols = 6;
    const rows = 12;
    const cellW = 1024 / cols;
    const cellH = 2048 / rows;
    const gap = 6; // Espaço do grid branco entre as células

    for(let r = 0; r < rows; r++){
        for(let c = 0; c < cols; c++){
            const x = c * cellW;
            const y = r * cellH;

            // 1. Célula de Silício (Azul Marinho Profundo, como na foto 2)
            ctx.fillStyle = '#0b1d3a'; 
            ctx.fillRect(x + gap, y + gap, cellW - gap*2, cellH - gap*2);

            // Silício é muito liso (baixa rugosidade) para dar o efeito espelhado base
            roughCtx.fillStyle = 'rgb(15, 15, 15)'; 
            roughCtx.fillRect(x + gap, y + gap, cellW - gap*2, cellH - gap*2);

            // 2. Busbars (As linhas prateadas verticais mais grossas)
            const numBusbars = 5;
            ctx.fillStyle = 'rgba(220, 230, 240, 0.85)'; // Prata
            roughCtx.fillStyle = 'rgb(120, 120, 120)'; // Prata reflete mais difuso
            for(let b=1; b<=numBusbars; b++){
                const bx = x + (cellW / (numBusbars+1)) * b;
                ctx.fillRect(bx - 1.5, y + gap, 3, cellH - gap*2);
                roughCtx.fillRect(bx - 1.5, y + gap, 3, cellH - gap*2);
            }

            // 3. Fingers (Linhas horizontais super finas)
            ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
            for(let f=1; f<=24; f++){
                const fy = y + gap + ((cellH - gap*2) / 25) * f;
                ctx.fillRect(x + gap, fy, cellW - gap*2, 1);
            }
        }
    }

    // 4. Moldura de Alumínio em volta da placa inteira (como na foto 1)
    ctx.fillStyle = '#7a848f'; 
    roughCtx.fillStyle = 'rgb(180, 180, 180)';
    const frameSize = 16;
    // Top, Bottom, Left, Right
    ctx.fillRect(0, 0, 1024, frameSize); 
    ctx.fillRect(0, 2048-frameSize, 1024, frameSize); 
    ctx.fillRect(0, 0, frameSize, 2048); 
    ctx.fillRect(1024-frameSize, 0, frameSize, 2048); 
    
    roughCtx.fillRect(0, 0, 1024, frameSize); 
    roughCtx.fillRect(0, 2048-frameSize, 1024, frameSize); 
    roughCtx.fillRect(0, 0, frameSize, 2048); 
    roughCtx.fillRect(1024-frameSize, 0, frameSize, 2048); 

    const map = new THREE.CanvasTexture(canvas);
    map.anisotropy = renderer.capabilities.getMaxAnisotropy();
    
    const roughnessMap = new THREE.CanvasTexture(roughCanvas);
    roughnessMap.anisotropy = renderer.capabilities.getMaxAnisotropy();

    return { map, roughnessMap };
}

const solarMats = createSolarMaterials();

// 1. Material da Superfície (Vidro com as Células Solares)
const panelMaterial = new THREE.MeshPhysicalMaterial({
    map: solarMats.map,
    roughnessMap: solarMats.roughnessMap,
    color: 0xffffff, 
    metalness: 0.85,  
    roughness: 0.5,   
    clearcoat: 1.0,   
    clearcoatRoughness: 0.04, 
});

// 2. Material da Estrutura Lateral (Alumínio Fosco e Sólido)
const frameMaterial = new THREE.MeshStandardMaterial({
    color: 0x8a929a, // Cinza alumínio
    metalness: 0.7,
    roughness: 0.5
});

// 3. Array de Materiais para o BoxGeometry (Direita, Esquerda, Cima, Baixo, Frente, Trás)
const panelMaterials = [
    frameMaterial, // Lado Direito
    frameMaterial, // Lado Esquerdo
    panelMaterial, // Topo (Vidro com as Células)
    frameMaterial, // Fundo
    frameMaterial, // Frente
    frameMaterial  // Trás
];

const arrayGroup = new THREE.Group();
// Placa levemente mais grossa para evidenciar a moldura de alumínio
const panelGeo = new THREE.BoxGeometry(3.5, 0.25, 6.5);

for (let x = 0; x < 15; x++) { 
    for (let z = 0; z < 10; z++) { 
        // Agora passamos o array de materiais no lugar de um só
        const panel = new THREE.Mesh(panelGeo, panelMaterials);
        panel.position.set((x - 7) * 3.8, 0, (z - 5) * 6.8);
        panel.castShadow = true;
        panel.receiveShadow = true;
        arrayGroup.add(panel);
    }
}

// ==========================================
// 2.5 PILARES DE SUSTENTAÇÃO (Com Iluminação 3D)
// ==========================================
// O segredo do 3D: Essa luz vem de baixo e na diagonal. 
// Ela cria um "degradê" na lateral dos cilindros, matando aquele visual chapado 2D.
const bounceLight = new THREE.DirectionalLight(0xa4d3f5, 1.5);
bounceLight.position.set(20, -50, 20); 
scene.add(bounceLight);

const pillarMaterial = new THREE.MeshStandardMaterial({
    color: 0x9ba6b5, // Alumínio polido claro
    metalness: 0.7,
    roughness: 0.3   // Bem liso para pegar o brilho da luz de rebote
});

// Usamos 24 segmentos no cilindro para ele ficar redondinho e capturar a luz perfeitamente
const pillarGeo = new THREE.CylinderGeometry(0.12, 0.12, 8, 24); 
for (let x = 0; x < 15; x += 2) { 
    for (let z = 0; z < 10; z += 2) { 
        const posX = (x - 7) * 3.8;
        const posZ = (z - 5) * 6.8;
        
        const pillar = new THREE.Mesh(pillarGeo, pillarMaterial);
        pillar.position.set(posX, -4, posZ); 
        pillar.receiveShadow = true;
        arrayGroup.add(pillar);
    }
}

arrayGroup.rotation.x = 0; 
scene.add(arrayGroup);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

// ==========================================
// 3. O SOL SUAVE E REALISTA
// ==========================================
const sunLight = new THREE.DirectionalLight(0xffffff, 6); 
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.camera.left = -30;
sunLight.shadow.camera.right = 30;
sunLight.shadow.camera.top = 30;
sunLight.shadow.camera.bottom = -30;
scene.add(sunLight);
scene.add(sunLight.target); // NECESSÁRIO: Adiciona o alvo na cena para movermos ele junto com o sol

function createSunGlowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    
    // Gradiente bem mais suave (dourado ao invés de vermelho/laranja forte)
    const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');     
    grad.addColorStop(0.15, 'rgba(255, 250, 230, 0.9)'); 
    grad.addColorStop(0.4, 'rgba(250, 210, 120, 0.4)'); // Dourado claro
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');           

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(canvas);
}

const sunMaterial = new THREE.SpriteMaterial({
    map: createSunGlowTexture(),
    blending: THREE.AdditiveBlending, 
    transparent: true,
    depthWrite: false,
    fog: false 
});
const sunSprite = new THREE.Sprite(sunMaterial);
sunSprite.scale.set(48, 48, 1); // Sol menor e mais elegante
scene.add(sunSprite);

// ==========================================
// 4. INTERAÇÃO E ANIMAÇÃO
// ==========================================
const mouse = new THREE.Vector2(0, 0.5);

window.addEventListener('mousemove', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// CORES SUAVES E CORPORATIVAS
const colorNoonZenith = new THREE.Color(0x3a8add);   // Azul céu super agradável
const colorNoonHorizon = new THREE.Color(0xa4d3f5);  // Azul pálido/claro no horizonte

const colorSunsetZenith = new THREE.Color(0x306090); // Continua azul, apenas um pouco mais denso
const colorSunsetHorizon = new THREE.Color(0xffc485); // Pêssego/Dourado super suave (nada de vermelho!)

const colorNoonSun = new THREE.Color(0xffffff);
const colorSunsetSun = new THREE.Color(0xffcc88); // Dourado suave

const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const time = clock.getElapsedTime();

    const targetX = mouse.x * 120; 
    const targetY = mouse.y * 50 + 10; 
    
    sunLight.position.x += (targetX - sunLight.position.x) * 0.05;
    sunLight.position.y += (targetY - sunLight.position.y) * 0.05;
    sunLight.position.z = -120; 

    // A MÁGICA DA ÓTICA PERFEITA:
    // Para que o reflexo 3D forme uma linha reta vertical perfeitamente embaixo do sol na sua tela 2D,
    // precisamos compensar a distorção de perspectiva. 
    // Fórmula: (Distância da Câmera ao Chão) / (Distância Total da Câmera ao Sol)
    // Z da Câmera = 22. Z do Sol = 120. Total = 142. (22 / 142 = 0.155)
    sunLight.target.position.x = sunLight.position.x * 0.155;

    sunSprite.position.copy(sunLight.position);

    // O SEGREDO DO PÔR DO SOL ATRASADO:
    // Mapeamos a transição para acontecer SOMENTE quando o mouse chega no terço final da tela
    let timeOfDay = (mouse.y + 0.5) / 0.7; // Começa a transição no Y = 0.2 e termina no Y = -0.5
    timeOfDay = Math.max(0, Math.min(1, timeOfDay));

    const currentZenith = colorSunsetZenith.clone().lerp(colorNoonZenith, timeOfDay);
    const currentHorizon = colorSunsetHorizon.clone().lerp(colorNoonHorizon, timeOfDay);
    
    skyDome.material.uniforms.colorTop.value.copy(currentZenith);
    skyDome.material.uniforms.colorBottom.value.copy(currentHorizon);

    scene.fog.color.copy(currentHorizon);
    bounceLight.color.copy(currentHorizon); // Faz a luz de baixo acompanhar a cor do céu

    const currentSunColor = colorSunsetSun.clone().lerp(colorNoonSun, timeOfDay);
    sunLight.color.copy(currentSunColor);
    sunSprite.material.color.copy(currentSunColor);

    arrayGroup.position.y = Math.sin(time * 0.5) * 0.1;

    renderer.render(scene, camera);
}

animate();
