'use client';

export type DevicePreset = 'android' | 'iphone' | 'desktop' | 'tablet';
export const DEVICES: { id: DevicePreset; name: string; width: number; height: number }[] = [
  { id: 'android', name: 'Android screen', width: 360, height: 800 },
  { id: 'iphone', name: 'iPhone screen', width: 393, height: 852 },
  { id: 'tablet', name: 'Tablet screen', width: 820, height: 1180 },
  { id: 'desktop', name: 'Desktop screen', width: 1440, height: 900 },
];

export function DeviceFrames({ onAdd }: { onAdd: (device: DevicePreset) => void }) {
  return (
    <div className="device-frames">
      <p className="panel-hint">Start a UI sketch at a common logical screen size.</p>
      {DEVICES.map((device) => (
        <button key={device.id} onClick={() => onAdd(device.id)}>
          <span className={`device-outline ${device.id}`} aria-hidden="true" />
          <span><strong>{device.name}</strong><small>{device.width} × {device.height}</small></span>
          <span aria-hidden="true">＋</span>
        </button>
      ))}
      <p className="panel-hint">
        Editable sketch frames, not functional HTML prototypes or auto-layout yet.
      </p>
    </div>
  );
}
