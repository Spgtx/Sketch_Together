'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { Canvas, FabricObject, Line } from 'fabric';
import { useChannel, usePresence } from '@ably-labs/react-hooks';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Pencil, Square, Circle, Palette, Trash2, ArrowLeft, PenLine, Copy, Users, Hand } from 'lucide-react';
import { toast } from 'sonner';
import { configureAbly } from "@ably-labs/react-hooks";
import { ably } from '@/lib/ably';
import * as fabric from "fabric";
import { Types } from "ably";

configureAbly({
  key: process.env.NEXT_PUBLIC_ABLY_KEY!,
  clientId: crypto.randomUUID()
});

interface CursorPosition {
  x: number;
  y: number;
  clientId: string;
  color: string;
}

const COLORS = [
  { name: 'Black', value: '#000000' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Green', value: '#10b981' },
  { name: 'Purple', value: '#8b5cf6' },
  { name: 'Orange', value: '#f97316' },
];

type Tool = "pencil" | "rectangle" | "circle" | "line" | "arrow" | "hand";

const USER_COLORS = ['#ef4444', '#3b82f6', '#10b981', '#8b5cf6', '#f97316', '#06b6d4'];

export default function WhiteboardRoom() {
  const params = useParams();
  const roomId = params.roomId as string;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<Canvas | null>(null);
  const [currentTool, setCurrentTool] = useState<Tool>("pencil");
  const [currentColor, setCurrentColor] = useState('#000000');
  const [cursors, setCursors] = useState<Map<string, CursorPosition>>(new Map());
  const [isDrawing, setIsDrawing] = useState(false);
  const userColorRef = useRef(USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)]);

  const [drawingChannel] = useChannel(`room-${roomId}-drawing`, (message) => {
    if (message.clientId === message.data.clientId) return;

    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    if (message.name === "canvas-cleared") {
      canvas.clear();
      canvas.backgroundColor = "#ffffff";
      canvas.renderAll();
    }
  });


  const [cursorChannel, ablyClient] = useChannel(
    `room-${roomId}-cursors`,
    (message) => {
    if (message.name === 'cursor-move') {
      const { clientId, x, y } = message.data;
      setCursors(prev => {
        const newCursors = new Map(prev);
        newCursors.set(clientId, {
          x,
          y,
          clientId,
          color: USER_COLORS[parseInt(clientId.slice(-1), 36) % USER_COLORS.length],
        });
        return newCursors;
      });
    }
  });

  const [presence] = usePresence(`room-${roomId}`, {
    color: userColorRef.current,
  });

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new fabric.Canvas(canvasRef.current, {
      width: window.innerWidth,
      height: window.innerHeight - 80,
      backgroundColor: "#ffffff",
      isDrawingMode: currentTool === "pencil",
    });

    fabricCanvasRef.current = canvas;


    canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
    canvas.freeDrawingBrush.width = 3;
    canvas.freeDrawingBrush.color = currentColor;

    loadCanvasState();

    canvas.on("path:created", (e) => {
      const obj = e.path;
      if (!obj) return;

      obj.set({ selectable: true });

      drawingChannel.publish("object-added", {
        object: obj.toObject(),
        clientId: ably.auth.clientId,
      });
      saveCanvasState();
    });

    drawingChannel.subscribe("object-added", (msg: Types.Message) => {
      const data = msg.data as { clientId: string; object: unknown };
      if (data.clientId === ably.auth.clientId) return;

      fabric.util.enlivenObjects([data.object], {
        onComplete: (enlivened: fabric.Object[]) => {
          enlivened.forEach((o) => fabricCanvasRef.current?.add(o));
          fabricCanvasRef.current?.renderAll();
        }
      }as unknown as any);
    });


    drawingChannel.subscribe("canvas-cleared", (msg) => {
      if (msg.data.clientId === ably.auth.clientId) return;

      canvas.clear();
      canvas.backgroundColor = "#ffffff";
      canvas.renderAll();
    });

    let lastSent = 0;
    const THROTTLE_MS = 100;

    canvas.on("mouse:move", (e) => {
      if (!(e.e instanceof MouseEvent)) return;
      const now = Date.now();
      if (now - lastSent < THROTTLE_MS) return;
      lastSent = now;

      const rect = canvas.getElement().getBoundingClientRect();
      const x = e.e.clientX - rect.left;
      const y = e.e.clientY - rect.top;

      cursorChannel.publish("cursor-move", {
        x,
        y,
        clientId: ably.auth.clientId,
      });
    });

    const handleResize = () => {
      canvas.setWidth(window.innerWidth);
      canvas.setHeight(window.innerHeight - 80);
      canvas.renderAll();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      canvas.dispose();
    };
  }, []);


  useEffect(() => {
  const canvas = fabricCanvasRef.current;
  if (!canvas) return;

  let drawingShape: fabric.Object | null = null;
  let startX = 0;
  let startY = 0;
  let isDrawing = false;

  const handleMouseDown = (opt: any) => {
    const pointer = canvas.getPointer(opt.e);
    startX = pointer.x;
    startY = pointer.y;
    isDrawing = true;

    canvas.isDrawingMode = currentTool === "pencil";

    if (currentTool === "rectangle") {
      drawingShape = new fabric.Rect({
        left: startX,
        top: startY,
        width: 0,
        height: 0,
        fill: "transparent",
        stroke: currentColor,
        strokeWidth: 3,
        selectable: false,
      });
    } else if (currentTool === "circle") {
      drawingShape = new fabric.Ellipse({
        left: startX,
        top: startY,
        rx: 0,
        ry: 0,
        fill: "transparent",
        stroke: currentColor,
        strokeWidth: 3,
        selectable: false,
      });
    } else if (currentTool === "line" || currentTool === "arrow") {
      drawingShape = new fabric.Line([startX, startY, startX, startY], {
        stroke: currentColor,
        strokeWidth: 3,
        selectable: false,
      });
    }

    if (drawingShape) canvas.add(drawingShape);
  };

  const handleMouseMove = (opt: any) => {
    if (!drawingShape || !isDrawing) return;

    const pointer = canvas.getPointer(opt.e);
    const w = pointer.x - startX;
    const h = pointer.y - startY;

    if (drawingShape.type === "rect") {
      drawingShape.set({
        width: Math.abs(w),
        height: Math.abs(h),
        left: w < 0 ? pointer.x : startX,
        top: h < 0 ? pointer.y : startY,
      });
    } else if (drawingShape.type === "ellipse") {
      drawingShape.set({
        rx: Math.abs(w) / 2,
        ry: Math.abs(h) / 2,
        left: w < 0 ? pointer.x : startX,
        top: h < 0 ? pointer.y : startY,
      });
    } else if (drawingShape.type === "line") {
      (drawingShape as fabric.Line).set({ x2: pointer.x, y2: pointer.y });
    }

    canvas.renderAll();
  };

  const handleMouseUp = () => {
    if (!drawingShape) return;

    drawingShape.set({ selectable: true });

    if (currentTool === "arrow" && drawingShape.type === "line") {
      const line = drawingShape as fabric.Line;
      const angle = (Math.atan2(line.y2! - line.y1!, line.x2! - line.x1!) * 180) / Math.PI;
      const head = new fabric.Triangle({
        left: line.x2,
        top: line.y2,
        originX: "center",
        originY: "center",
        angle: angle + 90,
        width: 12,
        height: 16,
        fill: currentColor,
        selectable: false,
        evented: false,
      });
      const group = new fabric.Group([line, head], { selectable: true });
      canvas.remove(line);
      canvas.add(group);
      drawingShape = group;
    }

    const objectData = drawingShape.toObject([
      "left", "top", "width", "height", "rx", "ry", "stroke", "fill",
      "strokeWidth", "angle", "originX", "originY", "selectable", "type", "points", "scaleX", "scaleY"
    ]);

    drawingChannel.publish("object-added", {
      object: objectData,
      clientId: ably.auth.clientId,
    });

    saveCanvasState();
    drawingShape = null;
    isDrawing = false;
  };

  if (currentTool === "hand") {
    canvas.isDrawingMode = false;
    canvas.selection = true;
    canvas.forEachObject((obj) => (obj.selectable = true));
  } else {
    canvas.selection = false;
  }

  canvas.on("mouse:down", handleMouseDown);
  canvas.on("mouse:move", handleMouseMove);
  canvas.on("mouse:up", handleMouseUp);

  return () => {
    canvas.off("mouse:down", handleMouseDown);
    canvas.off("mouse:move", handleMouseMove);
    canvas.off("mouse:up", handleMouseUp);
  };
}, [currentTool, currentColor]);




  const loadCanvasState = async () => {
    try {
      const response = await fetch(`/api/canvas/${roomId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.state && fabricCanvasRef.current) {
          fabricCanvasRef.current.loadFromJSON(data.state, () => {
            fabricCanvasRef.current?.renderAll();
          });
        }
      }
    } catch (error) {
      console.error('Failed to load canvas state:', error);
    }
  };

  const saveCanvasState = async () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    try {
      const state = JSON.stringify(canvas.toJSON());
      await fetch(`/api/canvas/${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state }),
      });
    } catch (error) {
      console.error('Failed to save canvas state:', error);
    }
  };

  /*const addShape = (type: 'rectangle' | 'circle') => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    let shape: FabricObject;
    
    if (type === 'rectangle') {
      shape = new fabric.Rect({
        left: 100,
        top: 100,
        width: 100,
        height: 80,
        fill: 'transparent',
        stroke: currentColor,
        strokeWidth: 3,
      });
    } else {
      shape = new fabric.Circle({
        left: 100,
        top: 100,
        radius: 50,
        fill: 'transparent',
        stroke: currentColor,
        strokeWidth: 3,
      });
    }

    canvas.add(shape);
    canvas.renderAll();
  };*/

  const clearCanvas = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    canvas.clear();
    canvas.backgroundColor = '#ffffff';
    canvas.renderAll();
    
    drawingChannel.publish('canvas-cleared', {
      clientId: ably.auth.clientId,
    });
    
    saveCanvasState();
    toast.success('Canvas cleared');
  };

  const copyRoomLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success('Room link copied to clipboard');
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Toolbar */}
      <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-4">
          {/* Drawing Tools */}
          <div className="flex items-center space-x-2">
            <Button
              variant={currentTool === 'pencil' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCurrentTool('pencil')}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant={currentTool === 'rectangle' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setCurrentTool('rectangle');
                {/*addShape('rectangle');*/}
              }}
            >
              <Square className="h-4 w-4" />
            </Button>
            <Button
              variant={currentTool === 'circle' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setCurrentTool('circle');
                {/*addShape('circle');*/}
              }}
            >
              <Circle className="h-4 w-4" />
            </Button>

            <Button
              variant={currentTool === 'line' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setCurrentTool('line');
              }}
            >
              <PenLine />
            </Button>

            <Button
              variant={currentTool === 'hand' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setCurrentTool('hand');
              }}
            >
              <Hand className="h-4 w-4" />
            </Button>

            <Button
              variant={currentTool === 'arrow' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setCurrentTool('arrow');
              }}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            
          </div>

          <Separator orientation="vertical" className="h-6" />

          {/* Color Picker */}
          <div className="flex items-center space-x-2">
            <Palette className="h-4 w-4 text-gray-500" />
            <Select value={currentColor} onValueChange={setCurrentColor}>
              <SelectTrigger className="w-32">
                <div className="flex items-center space-x-2">
                  <div 
                    className="w-4 h-4 rounded-full border border-gray-300"
                    style={{ backgroundColor: currentColor }}
                  />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                {COLORS.map((color) => (
                  <SelectItem key={color.value} value={color.value}>
                    <div className="flex items-center space-x-2">
                      <div 
                        className="w-4 h-4 rounded-full border border-gray-300"
                        style={{ backgroundColor: color.value }}
                      />
                      <span>{color.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator orientation="vertical" className="h-6" />

          {/* Actions */}
          <Button variant="outline" size="sm" onClick={clearCanvas}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center space-x-4">
          {/* Online Users */}
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Users className="h-4 w-4" />
            <span>{presence.length} online</span>
          </div>

          <Button variant="outline" size="sm" onClick={copyRoomLink}>
            <Copy className="h-4 w-4 mr-2" />
            Share Link
          </Button>
        </div>
      </div>

      {/* Canvas Container */}
      <div className="flex-1 relative overflow-hidden">
        <canvas ref={canvasRef} />
        
        {/* Live Cursors */}
        {Array.from(cursors.values()).map((cursor) => (
          <div
            key={cursor.clientId}
            className="absolute pointer-events-none z-10 transition-all duration-100"
            style={{
              left: cursor.x,
              top: cursor.y,
              transform: 'translate(-2px, -2px)',
            }}
          >
            <div
              className="w-4 h-4 rounded-full border-2 border-white shadow-md"
              style={{ backgroundColor: cursor.color }}
            />
            <div
              className="mt-1 px-2 py-1 text-xs text-white rounded shadow-md"
              style={{ backgroundColor: cursor.color }}
            >
              User {cursor.clientId.slice(-4)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}