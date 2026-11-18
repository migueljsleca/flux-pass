// Three.js scene for Flux Pass. Authored as JS with badge-scene.d.ts and
// imports Three through ./three-untyped so the Toolcraft source-boundary type
// walker never traverses the recursive Object3D type graph.
import {
  BackSide,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CapsuleGeometry,
  CatmullRomCurve3,
  CylinderGeometry,
  DirectionalLight,
  ExtrudeGeometry,
  FrontSide,
  Group,
  Matrix4,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  NeutralToneMapping,
  Path,
  PerspectiveCamera,
  Plane,
  PMREMGenerator,
  Raycaster,
  RepeatWrapping,
  RoomEnvironment,
  Scene,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
  TorusGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "./three-untyped";
import { BADGE_FACE_HEIGHT, BADGE_SLOT } from "./badge-art";
import {
  BADGE_CARD_HEIGHT as H,
  BADGE_CARD_THICKNESS as T,
  BADGE_CARD_WIDTH as W,
  BADGE_CLIP_OFFSET,
} from "./badge-physics";

const CORNER = 0.055;
const STRAP_WIDTH = 0.13;
const STRAP_SAMPLES = 72;
/** Extra strap above the anchor so its end never shows at the top of the frame. */
const STRAP_LEAD = 2.5;
const SLOT_W = (BADGE_SLOT.width / BADGE_FACE_HEIGHT) * H;
const SLOT_H = (BADGE_SLOT.height / BADGE_FACE_HEIGHT) * H;
const SLOT_Y = H / 2 - (BADGE_SLOT.centerY / BADGE_FACE_HEIGHT) * H;
const RING_RADIUS = 0.05;
const RING_TUBE = 0.0075;

function roundedRect(path, x, y, width, height, radius) {
  path.moveTo(x + radius, y);
  path.lineTo(x + width - radius, y);
  path.quadraticCurveTo(x + width, y, x + width, y + radius);
  path.lineTo(x + width, y + height - radius);
  path.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  path.lineTo(x + radius, y + height);
  path.quadraticCurveTo(x, y + height, x, y + height - radius);
  path.lineTo(x, y + radius);
  path.quadraticCurveTo(x, y, x + radius, y);
}

function createCardShape() {
  const shape = new Shape();
  roundedRect(shape, -W / 2, -H / 2, W, H, CORNER);
  const slot = new Path();
  roundedRect(slot, -SLOT_W / 2, SLOT_Y - SLOT_H / 2, SLOT_W, SLOT_H, SLOT_H / 2);
  shape.holes.push(slot);
  return shape;
}

/** Face geometry with UVs spanning the whole card (front reads left-to-right from the front, back from behind). */
function createFaceGeometry(shape, back) {
  const geometry = new ShapeGeometry(shape, 18);
  const position = geometry.getAttribute("position");
  const uv = geometry.getAttribute("uv");
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    uv.setXY(i, back ? 0.5 - x / W : x / W + 0.5, y / H + 0.5);
  }
  uv.needsUpdate = true;
  geometry.translate(0, 0, back ? -T / 2 - 0.0004 : T / 2 + 0.0004);
  return geometry;
}

function createTexture(source, anisotropy) {
  const texture = new CanvasTexture(source);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = anisotropy;
  return texture;
}

function setVector(target, value) {
  target.set(value[0], value[1], value[2]);
  return target;
}

export class BadgeScene {
  constructor({ antialias, canvas, preserveDrawingBuffer = false }) {
    this.canvas = canvas;
    this.renderer = new WebGLRenderer({ alpha: true, antialias, canvas, preserveDrawingBuffer, premultipliedAlpha: true });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = NeutralToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.maxTextureSize = this.renderer.capabilities.maxTextureSize;
    this.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());

    this.scene = new Scene();
    const pmrem = new PMREMGenerator(this.renderer);
    this.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.scene.environment = this.environment;
    this.scene.environmentIntensity = 0.55;
    const key = new DirectionalLight(0xffffff, 0.9);
    key.position.set(1.5, 3, 4);
    this.scene.add(key);
    const fill = new DirectionalLight(0xffffff, 0.25);
    fill.position.set(-3, 1, 2);
    this.scene.add(fill);

    this.camera = new PerspectiveCamera(30, 1, 0.1, 60);

    // Materials and textures shared by every badge rig.
    this.shape = createCardShape();
    this.frontTexture = null;
    this.backTexture = null;
    // Printed faces keep their exact design colours: the artwork glows as
    // emissive (no tone mapping) with a little lit diffuse for shading, and
    // the clearcoat adds glossy highlights from the key light only.
    this.frontMaterial = new MeshPhysicalMaterial({
      clearcoat: 0.35,
      clearcoatRoughness: 0.2,
      emissive: 0xffffff,
      emissiveIntensity: 1,
      envMapIntensity: 0,
      roughness: 0.6,
      specularIntensity: 0,
      side: FrontSide,
      toneMapped: false,
    });
    this.frontMaterial.color.setScalar(0.06);
    this.backMaterial = this.frontMaterial.clone();
    this.backMaterial.side = BackSide;
    this.capMaterial = new MeshStandardMaterial({ visible: false });
    this.edgeMaterial = new MeshPhysicalMaterial({ clearcoat: 0.5, color: 0x222222, roughness: 0.5 });
    this.steel = new MeshPhysicalMaterial({ color: 0xd9dce1, metalness: 1, roughness: 0.22 });
    this.paint = new MeshPhysicalMaterial({ clearcoat: 0.6, clearcoatRoughness: 0.2, color: 0x3dbe7a, metalness: 0.25, roughness: 0.35 });
    this.strapMaterial = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, side: FrontSide });
    this.strapBackMaterial = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, side: BackSide });
    this.strapTexture = null;
    this.strapTileRatio = 2.4;
    /** One rig per badge on screen (front badge, optional back badge). */
    this.rigs = [];

    this.raycaster = new Raycaster();
    this.ndc = new Vector2();
    this.artKey = "";
    this.strapKey = "";
  }

  update(params, art, poses) {
    if (art.key !== this.artKey) {
      this.artKey = art.key;
      this.frontTexture?.dispose();
      this.backTexture?.dispose();
      this.frontTexture = createTexture(art.front, this.anisotropy);
      this.backTexture = createTexture(art.back, this.anisotropy);
      this.frontMaterial.map = this.frontTexture;
      this.frontMaterial.emissiveMap = this.frontTexture;
      this.backMaterial.map = this.backTexture;
      this.backMaterial.emissiveMap = this.backTexture;
      this.frontMaterial.needsUpdate = true;
      this.backMaterial.needsUpdate = true;
    }
    if (art.strapKey !== this.strapKey) {
      this.strapKey = art.strapKey;
      this.strapTileRatio = art.strap.width / art.strap.height;
      this.strapTexture?.dispose();
      this.strapTexture = createTexture(art.strap, this.anisotropy);
      this.strapTexture.wrapS = RepeatWrapping;
      this.strapMaterial.map = this.strapTexture;
      this.strapBackMaterial.map = this.strapTexture;
      this.strapMaterial.needsUpdate = true;
      this.strapBackMaterial.needsUpdate = true;
    }
    this.edgeMaterial.color.set(params.cardColor).multiplyScalar(0.8);
    this.paint.color.set(params.clipColor);
    while (this.rigs.length < poses.length) this.rigs.push(new BadgeRig(this));
    this.rigs.forEach((rig, index) => {
      const pose = poses[index];
      rig.setVisible(Boolean(pose));
      if (pose) rig.setPose(pose, this.strapTileRatio);
    });
  }

  applyCamera(camera, aspect) {
    this.camera.fov = camera.fov;
    this.camera.aspect = aspect;
    setVector(this.camera.position, camera.position);
    this.camera.lookAt(camera.target[0], camera.target[1], camera.target[2]);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld(true);
  }

  render(width, height, camera) {
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.renderer.setSize(w, h, false);
    }
    this.applyCamera(camera, w / h);
    this.renderer.render(this.scene, this.camera);
  }

  hitCard(ndcX, ndcY) {
    this.ndc.set(ndcX, ndcY);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    let best = null;
    this.rigs.forEach((rig, index) => {
      if (!rig.card.visible) return;
      const hit = this.raycaster.intersectObjects(rig.hitMeshes, false)[0];
      if (hit && (!best || hit.distance < best.hit.distance)) best = { hit, index, rig };
    });
    if (!best) return null;
    const point = best.hit.point;
    const local = best.rig.card.worldToLocal(point.clone());
    return {
      index: best.index,
      point: [point.x, point.y, point.z],
      u: Math.min(1, Math.max(0, local.x / W + 0.5)),
      v: Math.min(1, Math.max(0, local.y / H + 0.5)),
    };
  }

  pointerOnPlane(ndcX, ndcY, through) {
    this.ndc.set(ndcX, ndcY);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const forward = new Vector3();
    this.camera.getWorldDirection(forward);
    const plane = new Plane().setFromNormalAndCoplanarPoint(forward, setVector(new Vector3(), through));
    const target = new Vector3();
    const hit = this.raycaster.ray.intersectPlane(plane, target);
    return hit ? [hit.x, hit.y, hit.z] : null;
  }

  dispose() {
    this.frontTexture?.dispose();
    this.backTexture?.dispose();
    this.strapTexture?.dispose();
    this.environment.dispose();
    this.scene.traverse((object) => {
      if (object.isMesh) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) material.dispose();
      }
    });
    this.renderer.dispose();
  }
}

/** One badge: card (faces, edge, clip hardware) and its strap ribbon. */
class BadgeRig {
  constructor(owner) {
    this.card = new Group();
    owner.scene.add(this.card);
    const shape = owner.shape;
    this.front = new Mesh(createFaceGeometry(shape, false), owner.frontMaterial);
    this.back = new Mesh(createFaceGeometry(shape, true), owner.backMaterial);
    const edgeGeometry = new ExtrudeGeometry(shape, { bevelEnabled: false, curveSegments: 18, depth: T });
    edgeGeometry.translate(0, 0, -T / 2);
    this.edge = new Mesh(edgeGeometry, [owner.capMaterial, owner.edgeMaterial]);
    this.card.add(this.front, this.back, this.edge);
    this.hitMeshes = [this.front, this.back, this.edge];

    // Clip: a steel split ring through the slot, a painted swivel clip up to the strap.
    const ring = new Mesh(new TorusGeometry(RING_RADIUS, RING_TUBE, 14, 40), owner.steel);
    ring.rotation.y = Math.PI / 2;
    ring.position.set(0, SLOT_Y + RING_RADIUS - SLOT_H * 0.25, 0);
    const clipTop = H / 2 + BADGE_CLIP_OFFSET;
    const ringTop = ring.position.y + RING_RADIUS;
    const bodyLength = Math.max(0.02, clipTop - ringTop - 0.075);
    const body = new Mesh(new CapsuleGeometry(0.022, bodyLength, 6, 16), owner.paint);
    body.position.set(0, ringTop + 0.03 + bodyLength / 2, 0);
    body.scale.set(1, 1, 0.7);
    const swivel = new Mesh(new CylinderGeometry(0.012, 0.012, 0.03, 16), owner.steel);
    swivel.position.set(0, ringTop + 0.012, 0);
    const loop = new Mesh(new TorusGeometry(0.03, 0.007, 12, 32), owner.paint);
    loop.position.set(0, clipTop - 0.022, 0);
    this.card.add(ring, body, swivel, loop);

    // Strap ribbon; the print reads correctly from both sides (back face mirrors the UVs across the strap).
    this.strapGeometry = new BufferGeometry();
    const vertices = STRAP_SAMPLES * 2;
    this.strapPositions = new Float32Array(vertices * 3);
    this.strapNormals = new Float32Array(vertices * 3);
    this.strapUvs = new Float32Array(vertices * 2);
    this.strapBackUvs = new Float32Array(vertices * 2);
    const index = [];
    for (let i = 0; i < STRAP_SAMPLES - 1; i += 1) {
      const a = i * 2;
      index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
    this.strapGeometry.setIndex(index);
    this.strapGeometry.setAttribute("position", new BufferAttribute(this.strapPositions, 3));
    this.strapGeometry.setAttribute("normal", new BufferAttribute(this.strapNormals, 3));
    this.strapGeometry.setAttribute("uv", new BufferAttribute(this.strapUvs, 2));
    this.strapBackGeometry = new BufferGeometry();
    this.strapBackGeometry.setIndex(index);
    this.strapBackGeometry.setAttribute("position", this.strapGeometry.getAttribute("position"));
    this.strapBackGeometry.setAttribute("normal", this.strapGeometry.getAttribute("normal"));
    this.strapBackGeometry.setAttribute("uv", new BufferAttribute(this.strapBackUvs, 2));
    this.strap = new Mesh(this.strapGeometry, owner.strapMaterial);
    this.strap.frustumCulled = false;
    this.strapBack = new Mesh(this.strapBackGeometry, owner.strapBackMaterial);
    this.strapBack.frustumCulled = false;
    owner.scene.add(this.strap, this.strapBack);
    this.basis = new Matrix4();
  }

  setVisible(visible) {
    this.card.visible = visible;
    this.strap.visible = visible;
    this.strapBack.visible = visible;
  }

  setPose(pose, tileRatio) {
    const { center, x, y, z } = pose.card;
    this.basis.makeBasis(setVector(new Vector3(), x), setVector(new Vector3(), y), setVector(new Vector3(), z));
    this.card.quaternion.setFromRotationMatrix(this.basis);
    setVector(this.card.position, center);
    this.card.updateMatrixWorld(true);
    this.updateStrap(pose, tileRatio);
  }

  updateStrap(pose, tileRatio) {
    const points = pose.strap.map((p) => setVector(new Vector3(), p));
    const anchor = points[0];
    points.unshift(new Vector3(anchor.x, anchor.y + STRAP_LEAD, anchor.z));
    const curve = new CatmullRomCurve3(points, false, "centripetal");
    const lengths = curve.getLengths(STRAP_SAMPLES * 2);
    const total = lengths[lengths.length - 1];
    const samples = [];
    const tangents = [];
    for (let i = 0; i < STRAP_SAMPLES; i += 1) {
      const u = i / (STRAP_SAMPLES - 1);
      samples.push(curve.getPointAt(u));
      tangents.push(curve.getTangentAt(u).normalize());
    }
    // Parallel-transport the strap's width direction from the top, then
    // spread the twist that lines the bottom end up with the card's width.
    const sides = [];
    let side = new Vector3(1, 0, 0);
    side.addScaledVector(tangents[0], -side.dot(tangents[0])).normalize();
    sides.push(side.clone());
    for (let i = 1; i < STRAP_SAMPLES; i += 1) {
      side = side.clone().addScaledVector(tangents[i], -side.dot(tangents[i]));
      if (side.lengthSq() < 1e-8) side = new Vector3(0, 0, 1).cross(tangents[i]);
      side.normalize();
      sides.push(side);
    }
    const endTangent = tangents[STRAP_SAMPLES - 1];
    const cardX = setVector(new Vector3(), pose.card.x);
    cardX.addScaledVector(endTangent, -cardX.dot(endTangent));
    let twist = 0;
    if (cardX.lengthSq() > 1e-8) {
      cardX.normalize();
      const endSide = sides[STRAP_SAMPLES - 1];
      // The strap is symmetric across its width: line up with whichever card edge is closer.
      if (endSide.dot(cardX) < 0) cardX.negate();
      twist = Math.atan2(new Vector3().crossVectors(endSide, cardX).dot(endTangent), endSide.dot(cardX));
    }
    const leadShare = STRAP_LEAD / Math.max(total, 1e-6);
    const normal = new Vector3();
    const tileLength = STRAP_WIDTH * tileRatio;
    for (let i = 0; i < STRAP_SAMPLES; i += 1) {
      const u = i / (STRAP_SAMPLES - 1);
      const along = Math.max(0, (u - leadShare) / Math.max(1e-6, 1 - leadShare));
      const s = sides[i].clone().applyAxisAngle(tangents[i], twist * along);
      normal.crossVectors(tangents[i], s).normalize();
      const p = samples[i];
      const half = STRAP_WIDTH / 2;
      const o = i * 6;
      this.strapPositions[o] = p.x - s.x * half;
      this.strapPositions[o + 1] = p.y - s.y * half;
      this.strapPositions[o + 2] = p.z - s.z * half;
      this.strapPositions[o + 3] = p.x + s.x * half;
      this.strapPositions[o + 4] = p.y + s.y * half;
      this.strapPositions[o + 5] = p.z + s.z * half;
      for (let k = 0; k < 2; k += 1) {
        this.strapNormals[o + k * 3] = normal.x;
        this.strapNormals[o + k * 3 + 1] = normal.y;
        this.strapNormals[o + k * 3 + 2] = normal.z;
      }
      // Text runs along the strap; one tile spans the strap width x tile ratio.
      const distance = (u * total) / tileLength;
      const uvOffset = i * 4;
      this.strapUvs[uvOffset] = distance;
      this.strapUvs[uvOffset + 1] = 0;
      this.strapUvs[uvOffset + 2] = distance;
      this.strapUvs[uvOffset + 3] = 1;
      this.strapBackUvs[uvOffset] = distance;
      this.strapBackUvs[uvOffset + 1] = 1;
      this.strapBackUvs[uvOffset + 2] = distance;
      this.strapBackUvs[uvOffset + 3] = 0;
    }
    this.strapGeometry.attributes.position.needsUpdate = true;
    this.strapGeometry.attributes.normal.needsUpdate = true;
    this.strapGeometry.attributes.uv.needsUpdate = true;
    this.strapBackGeometry.attributes.uv.needsUpdate = true;
  }
}
