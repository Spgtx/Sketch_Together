import { Canvas, Rect, Textbox, Line, type FabricObject } from 'fabric';
import type { Template } from './boards';

type TextOptions = Record<string, unknown>;

function label(text: string, x: number, y: number, options: TextOptions = {}) {
  return new Textbox(text, {
    left: x,
    top: y,
    width: 210,
    fontFamily: 'Arial',
    fontSize: 22,
    fontWeight: 'bold',
    fill: '#292923',
    editable: true,
    ...options,
  });
}

function note(text: string, x: number, y: number, fill: string) {
  return new Textbox(text, {
    left: x,
    top: y,
    width: 180,
    fontSize: 20,
    fontFamily: 'Arial',
    fontWeight: 'bold',
    fill: '#292923',
    backgroundColor: fill,
    padding: 20,
    editable: true,
    angle: x % 3 === 0 ? -3 : 3,
  });
}

function box(x: number, y: number, width: number, height: number, fill: string) {
  return new Rect({
    left: x,
    top: y,
    width,
    height,
    rx: 9,
    ry: 9,
    fill,
    stroke: '#292923',
    strokeWidth: 2,
  });
}

/** Add starter objects only when the room has no persisted state. */
export function seedTemplate(canvas: Canvas, template: Template) {
  const objects: FabricObject[] = [];

  if (template === 'brainstorm') {
    objects.push(
      label('What if we…', 310, 120, { fontSize: 38, width: 390 }),
      note('Start with a wild idea', 190, 255, '#f7d78c'),
      note('What could go wrong?', 447, 245, '#dbd4ed'),
      note('What would be amazing?', 324, 435, '#c9e1ce'),
    );
  } else if (template === 'flow') {
    objects.push(
      label('Make the path visible', 278, 110, { fontSize: 32, width: 420 }),
      box(155, 275, 180, 100, '#f8d88b'),
      label('Start', 210, 310, { width: 105, fontSize: 23 }),
      new Line([337, 327, 475, 327], { stroke: '#292923', strokeWidth: 4 }),
      label('→', 396, 288, { width: 60, fontSize: 48 }),
      box(482, 275, 180, 100, '#c8dccc'),
      label('Next step', 510, 310, { width: 148, fontSize: 23 }),
      label('Add more steps, connections and decisions.', 205, 450, {
        fontSize: 17,
        width: 520,
        fill: '#706d65',
      }),
    );
  } else if (template === 'retro') {
    objects.push(
      label('What did we learn?', 258, 100, { fontSize: 35, width: 440 }),
      note('KEEP\nWhat worked?', 120, 280, '#cce3d1'),
      note('CHANGE\nWhat hurt?', 350, 280, '#f7d99a'),
      note('TRY\nWhat next?', 575, 280, '#ddd5f0'),
    );
  } else {
    return;
  }

  objects.forEach((object) => {
    (object as FabricObject & { id: string }).id = crypto.randomUUID();
    canvas.add(object);
  });
  canvas.requestRenderAll();
}
