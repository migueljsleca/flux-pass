/*
 * Opaque declarations for the Three.js members used by badge-scene.js.
 *
 * The Toolcraft code-health/product-boundary type walker recurses without
 * bound through Three's Object3D type graph (Object3D.children: Object3D[])
 * and overflows the stack. Exposing Three through these opaque declarations
 * keeps the boundary checker usable; the public BadgeScene API stays typed in
 * badge-scene.d.ts.
 */
type ThreeClass = new (...args: never[]) => object;

export declare const BackSide: string | number;
export declare const BufferAttribute: ThreeClass;
export declare const BufferGeometry: ThreeClass;
export declare const CanvasTexture: ThreeClass;
export declare const CapsuleGeometry: ThreeClass;
export declare const CatmullRomCurve3: ThreeClass;
export declare const CylinderGeometry: ThreeClass;
export declare const DirectionalLight: ThreeClass;
export declare const ExtrudeGeometry: ThreeClass;
export declare const FrontSide: string | number;
export declare const Group: ThreeClass;
export declare const Matrix4: ThreeClass;
export declare const Mesh: ThreeClass;
export declare const MeshPhysicalMaterial: ThreeClass;
export declare const MeshStandardMaterial: ThreeClass;
export declare const NeutralToneMapping: string | number;
export declare const Path: ThreeClass;
export declare const PerspectiveCamera: ThreeClass;
export declare const Plane: ThreeClass;
export declare const PMREMGenerator: ThreeClass;
export declare const Raycaster: ThreeClass;
export declare const RepeatWrapping: string | number;
export declare const RoomEnvironment: ThreeClass;
export declare const Scene: ThreeClass;
export declare const Shape: ThreeClass;
export declare const ShapeGeometry: ThreeClass;
export declare const SRGBColorSpace: string | number;
export declare const TorusGeometry: ThreeClass;
export declare const Vector2: ThreeClass;
export declare const Vector3: ThreeClass;
export declare const WebGLRenderer: ThreeClass;
