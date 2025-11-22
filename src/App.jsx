// src/App.jsx
import React, {
  useCallback,
  useRef,
  useState,
} from 'react';
import SceneCanvas from './SceneCanvas.jsx';

const toRad = (deg) => (deg * Math.PI) / 180;

function ToolButton({
  icon,
  label,
  onClick,
  active = false,
  disabled = false,
}) {
  const base =
    'relative flex items-center justify-center w-9 h-9 rounded-full border text-xs font-medium transition-colors';
  const activeStyle = active
    ? 'bg-sky-500 border-sky-300 text-slate-900 shadow-lg'
    : 'bg-slate-900 border-slate-700 hover:border-slate-500';
  const disabledStyle = disabled
    ? 'opacity-40 cursor-not-allowed hover:border-slate-700'
    : '';

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`${base} ${activeStyle} ${disabledStyle}`}
    >
      {icon}
    </button>
  );
}

export default function App() {
  const [assets, setAssets] = useState([]); // imported OBJ files
  const [objects, setObjects] = useState([]); // instances in scene
  const [selectedId, setSelectedId] = useState(null);
  const [activeTool, setActiveTool] = useState('none'); // 'none' | 'move'
  const [isRaining, setIsRaining] = useState(false);
  const [rainSpeed, setRainSpeed] = useState(0.5); // 0.1–1
  const [undoStack, setUndoStack] = useState([]);

  const fileInputRef = useRef(null);
  const sceneRef = useRef(null);

  const selectedObject = objects.find((o) => o.id === selectedId) || null;

  // ---- Undo management ----
  const pushUndo = useCallback(() => {
    const snapshot = {
      objects: objects.map((o) => ({ ...o })),
      selectedId,
      isRaining,
      rainSpeed,
    };
    setUndoStack((stack) => [...stack, snapshot]);
  }, [objects, selectedId, isRaining, rainSpeed]);

  const handleUndo = () => {
    setUndoStack((stack) => {
      if (!stack.length) return stack;
      const last = stack[stack.length - 1];
      setObjects(last.objects);
      setSelectedId(last.selectedId);
      setIsRaining(last.isRaining);
      setRainSpeed(last.rainSpeed);
      return stack.slice(0, -1);
    });
  };

  // ---- Import OBJ ----
  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const id =
      crypto.randomUUID?.() ||
      `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    setAssets((prev) => [
      ...prev,
      {
        id,
        name: file.name.replace(/\.obj$/i, ''),
        objUrl: url,
      },
    ]);

    // allow user to pick same file again
    e.target.value = '';
  };

  const handleAddObjectFromAsset = (asset) => {
    pushUndo();
    const id =
      crypto.randomUUID?.() ||
      `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const newObj = {
      id,
      assetId: asset.id,
      name: asset.name,
      objUrl: asset.objUrl,
      position: [0, 1, 0],
      rotation: [0, 0, 0],
      scale: 1,
    };

    setObjects((prev) => [...prev, newObj]);
    setSelectedId(id);
  };

  // ---- Tools ----

  const handleDuplicate = () => {
    if (!selectedObject) return;
    pushUndo();
    const id =
      crypto.randomUUID?.() ||
      `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const offset = 0.5;
    const dup = {
      ...selectedObject,
      id,
      position: [
        selectedObject.position[0] + offset,
        selectedObject.position[1],
        selectedObject.position[2] + offset,
      ],
    };
    setObjects((prev) => [...prev, dup]);
    setSelectedId(id);
  };

  const handleToggleMoveTool = () => {
    if (!selectedObject) return;
    setActiveTool((prev) => (prev === 'move' ? 'none' : 'move'));
  };

  const rotateSelectedAxis = (axisIndex) => {
    if (!selectedObject) return;
    pushUndo();
    setObjects((prev) =>
      prev.map((o) => {
        if (o.id !== selectedObject.id) return o;
        const rot = [...o.rotation];
        rot[axisIndex] += toRad(15); // 15 degrees per click
        return { ...o, rotation: rot };
      })
    );
  };

  const handleZoom = (direction) => {
    if (!selectedObject) return;
    pushUndo();
    const factor = direction === 'in' ? 1.1 : 0.9;
    setObjects((prev) =>
      prev.map((o) => {
        if (o.id !== selectedObject.id) return o;
        const newScale = Math.min(
          Math.max(o.scale * factor, 0.1),
          10
        );
        return { ...o, scale: newScale };
      })
    );
  };

  const handleDeleteSelected = () => {
    if (!selectedObject) return;
    pushUndo();
    setObjects((prev) =>
      prev.filter((o) => o.id !== selectedObject.id)
    );
    setSelectedId(null);
  };

  const handleCenterCamera = () => {
    if (!selectedObject || !sceneRef.current) return;
    sceneRef.current.centerOnObject(selectedObject);
  };

  const handleExportScene = () => {
    sceneRef.current?.exportSceneAsGLB();
  };

  // ---- Rain ----
  const handleMakeItRain = () => {
    // Put objs up in the air once when enabling rain.
    if (!isRaining) {
      pushUndo();
      setObjects((prev) =>
        prev.map((o, i) => ({
          ...o,
          position: [
            o.position[0],
            8 + i * 0.8,
            o.position[2],
          ],
        }))
      );
    }
    setIsRaining((prev) => !prev);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Top bar: import + asset buttons */}
      <header className="flex items-center gap-3 border-b border-slate-800 bg-slate-900/80 px-4 py-3 backdrop-blur">
        <button
          type="button"
          onClick={openFileDialog}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-600 bg-slate-900 text-lg font-bold hover:border-slate-300"
          title="Import OBJ"
        >
          +
        </button>

        <div className="flex-1 flex items-center gap-2 overflow-x-auto">
          {assets.length === 0 && (
            <p className="text-xs text-slate-500">
              Import .obj files to add them here.
            </p>
          )}
          {assets.map((asset) => (
            <button
              key={asset.id}
              onClick={() =>
                handleAddObjectFromAsset(asset)
              }
              className="whitespace-nowrap rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs hover:border-slate-400"
            >
              {asset.name}
            </button>
          ))}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".obj"
          className="hidden"
          onChange={handleFileChange}
        />
      </header>

      {/* Speed slider for rain */}
      <div className="flex items-center gap-4 border-b border-slate-900 px-5 py-3">
        <span className="text-sm font-semibold">Speed</span>
        <div className="flex flex-col gap-1">
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.01"
            value={rainSpeed}
            onChange={(e) =>
              setRainSpeed(parseFloat(e.target.value))
            }
            className="w-72 accent-sky-500"
          />
          <div className="flex justify-between text-[10px] uppercase tracking-[0.16em] text-slate-400">
            <span>Slow</span>
            <span>Fast</span>
          </div>
        </div>
      </div>

      {/* Main area */}
      <main className="relative flex-1 overflow-hidden">
        {/* 3D viewport */}
        <div className="absolute inset-4 rounded-xl border border-slate-800 bg-slate-950">
          <SceneCanvas
            ref={sceneRef}
            objects={objects}
            setObjects={setObjects}
            selectedId={selectedId}
            setSelectedId={setSelectedId}
            activeTool={activeTool}
            isRaining={isRaining}
            rainSpeed={rainSpeed}
            onBeginTransform={pushUndo}
          />

          {/* Make it rain button */}
          <button
            type="button"
            onClick={handleMakeItRain}
            className="absolute left-6 bottom-28 rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-xl hover:bg-sky-400"
          >
            {isRaining ? 'Stop rain' : 'Make it rain!'}
          </button>

          {/* Bottom toolbar (9 tools) */}
          <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
            <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-slate-700 bg-slate-900/95 px-5 py-2 shadow-2xl">
              {/* 1. Duplicate */}
              <ToolButton
                icon="⧉"
                label="Duplicate OBJ"
                onClick={handleDuplicate}
                disabled={!selectedObject}
              />
              {/* 2. Move */}
              <ToolButton
                icon="✥"
                label="Move tool (drag in viewport)"
                active={activeTool === 'move'}
                onClick={handleToggleMoveTool}
                disabled={!selectedObject || isRaining}
              />
              {/* 3. Rotate (longitudinal: Y) */}
              <ToolButton
                icon="↻Y"
                label="Rotate (longitudinal / Y)"
                onClick={() => rotateSelectedAxis(1)}
                disabled={!selectedObject}
              />
              {/* 4. Rotate (latitudinal: X) */}
              <ToolButton
                icon="↻X"
                label="Rotate (latitudinal / X)"
                onClick={() => rotateSelectedAxis(0)}
                disabled={!selectedObject}
              />

              {/* 5. Zoom in/out */}
              <div className="flex items-center gap-1 pl-2 border-l border-slate-700">
                <ToolButton
                  icon="+"
                  label="Zoom in"
                  onClick={() => handleZoom('in')}
                  disabled={!selectedObject}
                />
                <ToolButton
                  icon="−"
                  label="Zoom out"
                  onClick={() => handleZoom('out')}
                  disabled={!selectedObject}
                />
              </div>

              {/* 6. Undo */}
              <ToolButton
                icon="↶"
                label="Undo last action"
                onClick={handleUndo}
                disabled={!undoStack.length}
              />

              {/* 7. Delete */}
              <ToolButton
                icon="🗑"
                label="Delete selected OBJ"
                onClick={handleDeleteSelected}
                disabled={!selectedObject}
              />

              {/* 8. Center camera */}
              <ToolButton
                icon="🎯"
                label="Center camera on object"
                onClick={handleCenterCamera}
                disabled={!selectedObject}
              />

              {/* 9. Export */}
              <ToolButton
                icon="⬇︎"
                label="Export scene as .glb"
                onClick={handleExportScene}
                disabled={!objects.length}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
