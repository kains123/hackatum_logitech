// src/SceneCanvas.jsx
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Canvas,
  useFrame,
  useLoader,
  useThree,
} from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

/**
 * One instance of an imported OBJ in the scene.
 */
function ObjInstance({
  data,
  isSelected,
  onSelect,
  setObjects,
  activeTool,
  onBeginTransform,
}) {
  const original = useLoader(OBJLoader, data.objUrl);

  // Clone the loaded model so each instance has its own transform.
  const object = useMemo(() => original.clone(), [original]);

  const [isDragging, setIsDragging] = useState(false);
  const dragPlane = useMemo(
    () => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
    []
  );

  // Color / material & shadow setup, plus simple selection highlight.
  useEffect(() => {
    object.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.material = new THREE.MeshStandardMaterial({
          color: isSelected ? '#38bdf8' : '#e5e7eb',
          metalness: 0.1,
          roughness: 0.85,
        });
      }
    });
  }, [object, isSelected]);


  const handlePointerDown = (e) => {
    e.stopPropagation();
    onSelect();

    if (activeTool === 'move') {
      if (!isDragging && onBeginTransform) {
        onBeginTransform();
      }
      setIsDragging(true);
    }
  };

  const handlePointerUp = (e) => {
    e.stopPropagation();
    setIsDragging(false);
  };

  // Drag along ground plane (XZ).
  const handlePointerMove = (e) => {
    if (!isDragging || activeTool !== 'move') return;
    e.stopPropagation();

    const intersection = new THREE.Vector3();
    if (e.ray.intersectPlane(dragPlane, intersection)) {
      const newPos = [intersection.x, data.position[1], intersection.z];
      setObjects((prev) =>
        prev.map((o) =>
          o.id === data.id ? { ...o, position: newPos } : o
        )
      );
    }
  };

  return (
    <primitive
      object={object}
      position={data.position}
      rotation={data.rotation}
      scale={data.scale}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerMove={handlePointerMove}
    />
  );
}

/**
 * The actual scene content that lives inside <Canvas>.
 * Exposed imperatively through a ref for centering & exporting.
 */
const SceneContent = forwardRef(function SceneContent(
  {
    objects,
    setObjects,
    selectedId,
    setSelectedId,
    activeTool,
    isRaining,
    rainSpeed,
    onBeginTransform,
  },
  ref
) {
  const { camera, scene } = useThree();
  const controlsRef = useRef();

  // Imperative API for the parent (App).
  useImperativeHandle(
    ref,
    () => ({
      centerOnObject: (obj) => {
        if (!obj) return;
        const [x, y, z] = obj.position;
        const offset = 6;
        camera.position.set(x + offset, y + offset, z + offset);
        if (controlsRef.current) {
          controlsRef.current.target.set(x, y, z);
          controlsRef.current.update();
        }
      },
      exportSceneAsGLB: () => {
        const exporter = new GLTFExporter();
        exporter.parse(
          scene,
          (result) => {
            let buffer;
            if (result instanceof ArrayBuffer) {
              buffer = result;
            } else {
              const json = JSON.stringify(result);
              buffer = new TextEncoder().encode(json).buffer;
            }
            const blob = new Blob([buffer], {
              type: 'model/gltf-binary',
            });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.style.display = 'none';
            link.href = url;
            link.download = 'scene.glb';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
          },
          { binary: true }
        );
      },
    }),
    [camera, scene]
  );

  // Rain animation
  useFrame((_, delta) => {
    if (!isRaining || !objects.length) return;
    const fallSpeed = 6 * rainSpeed; // slider scales this

    setObjects((prev) =>
      prev.map((obj) => {
        let [x, y, z] = obj.position;
        y -= fallSpeed * delta;
        // Reset to "sky" when below ground so it keeps raining.
        if (y < -10) y = 10 + Math.random() * 2;
        return { ...obj, position: [x, y, z] };
      })
    );
  });

  return (
    <>
      {/* Lights & simple ground */}
      <ambientLight intensity={0.7} />
      <directionalLight
        position={[10, 14, 8]}
        intensity={1.2}
        castShadow
      />
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.01, 0]}
        receiveShadow
      >
        <planeGeometry args={[50, 50]} />
        <meshStandardMaterial color="#020617" />
      </mesh>
      <gridHelper
        args={[40, 40, '#334155', '#111827']}
        position={[0, 0.01, 0]}
      />

      {/* All objects */}
      {objects.map((obj) => (
        <ObjInstance
          key={obj.id}
          data={obj}
          isSelected={selectedId === obj.id}
          onSelect={() => setSelectedId(obj.id)}
          setObjects={setObjects}
          activeTool={activeTool}
          onBeginTransform={onBeginTransform}
        />
      ))}

      {/* Orbit controls */}
      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.1}
        rotateSpeed={0.7}
      />
    </>
  );
});

/**
 * Canvas wrapper component used by App.
 */
const SceneCanvas = forwardRef(function SceneCanvas(props, ref) {
  return (
    <Canvas
      shadows
      camera={{ position: [6, 6, 10], fov: 45 }}
      className="w-full h-full rounded-xl bg-slate-950"
    >
      <color attach="background" args={['#020617']} />
      <SceneContent {...props} ref={ref} />
    </Canvas>
  );
});

export default SceneCanvas;
