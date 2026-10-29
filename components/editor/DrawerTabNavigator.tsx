'use client';

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { StudioIcon, type IconName } from '@/components/StudioIcon';

export type DrawerTab =
  | 'ink' | 'paint' | 'stickers' | 'paper' | 'layers' | 'saves'
  | 'text' | 'vectors' | 'frames' | 'components' | 'fills' | 'export';

type TabInfo = {
  id: DrawerTab;
  label: string;
  description: string;
  icon: IconName;
};

export const DRAWER_TABS: TabInfo[] = [
  { id: 'ink', label: 'Art', description: 'Vector brushes', icon: 'brush' },
  { id: 'paint', label: 'Paint', description: 'Pixel painting', icon: 'paint-pixels' },
  { id: 'stickers', label: 'Stickers', description: 'Sticker library', icon: 'sticker-sheet' },
  { id: 'paper', label: 'Paper', description: 'Canvas paper', icon: 'paper-page' },
  { id: 'layers', label: 'Layers', description: 'Object layers', icon: 'layers' },
  { id: 'saves', label: 'Saves', description: 'Board checkpoints', icon: 'save' },
  { id: 'text', label: 'Type', description: 'Text formatting', icon: 'text' },
  { id: 'vectors', label: 'Paths', description: 'Vector operations', icon: 'vector-ops' },
  { id: 'frames', label: 'Frames', description: 'Device frames', icon: 'device-frame' },
  { id: 'components', label: 'Pieces', description: 'Reusable components', icon: 'pieces' },
  { id: 'fills', label: 'Fills', description: 'Gradients and mesh fills', icon: 'paint-bucket' },
  { id: 'export', label: 'Export', description: 'Download artwork', icon: 'download' },
];

type Props = {
  value: DrawerTab;
  onChange: (tab: DrawerTab) => void;
};

/** Scrollable, icon-first tabs, with explicit arrows and an all-tools selector. */
export function DrawerTabNavigator({ value, onChange }: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canPrevious, setCanPrevious] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const updateEdges = useCallback(() => {
    const element = scrollerRef.current;
    if (!element) return;
    setCanPrevious(element.scrollLeft > 2);
    setCanNext(element.scrollLeft + element.clientWidth < element.scrollWidth - 2);
  }, []);

  useEffect(() => {
    const element = scrollerRef.current;
    if (!element) return;

    updateEdges();
    const observer = new ResizeObserver(updateEdges);
    observer.observe(element);
    window.addEventListener('resize', updateEdges);

    // Vertical wheel gestures navigate tabs only while more tabs remain in that direction.
    function onWheel(event: WheelEvent) {
      if (!element) return;
      if (event.ctrlKey || event.metaKey) return;
      const distance = Math.abs(event.deltaX) > Math.abs(event.deltaY)
        ? event.deltaX
        : event.deltaY;
      const atStart = element.scrollLeft <= 1;
      const atEnd = element.scrollLeft + element.clientWidth >= element.scrollWidth - 1;
      if ((distance < 0 && atStart) || (distance > 0 && atEnd)) return;
      if (!distance) return;
      event.preventDefault();
      element.scrollLeft += distance;
      updateEdges();
    }

    element.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateEdges);
      element.removeEventListener('wheel', onWheel);
    };
  }, [updateEdges]);

  useEffect(() => {
    const element = scrollerRef.current;
    const active = element?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!element || !active) return;

    const left = active.offsetLeft;
    const right = left + active.offsetWidth;
    const currentLeft = element.scrollLeft;
    const currentRight = currentLeft + element.clientWidth;
    if (left < currentLeft) element.scrollLeft = left;
    else if (right > currentRight) element.scrollLeft = right - element.clientWidth;
    updateEdges();
  }, [value, updateEdges]);

  function nudge(direction: -1 | 1) {
    const element = scrollerRef.current;
    if (!element) return;
    element.scrollBy({ left: direction * Math.max(140, element.clientWidth * 0.75),
      behavior: 'smooth' });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = DRAWER_TABS.findIndex((tab) => tab.id === value);
    let nextIndex = index;
    if (event.key === 'ArrowRight') nextIndex = Math.min(DRAWER_TABS.length - 1, index + 1);
    else if (event.key === 'ArrowLeft') nextIndex = Math.max(0, index - 1);
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = DRAWER_TABS.length - 1;
    else return;

    event.preventDefault();
    const next = DRAWER_TABS[nextIndex];
    onChange(next.id);
    document.getElementById(`studio-tab-${next.id}`)?.focus();
  }

  return (
    <nav className="maker-tab-navigation" aria-label="Studio drawer sections">
      <div className="maker-tab-heading">
        <span className="maker-tab-eyebrow">{/*YOUR TOOL SHELF / {DRAWER_TABS.length}*/}</span>
        <label className="maker-tab-jump">
          <span className="sr-only">Jump to studio tool</span>
          <select value={value} onChange={(event) => onChange(event.target.value as DrawerTab)}
            aria-label="Jump to any studio tool">
            {DRAWER_TABS.map((item) => (
              <option key={item.id} value={item.id}>{item.label} · {item.description}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="maker-tab-strip">
        <button type="button" className="maker-tab-nudge maker-tab-back"
          aria-label="Scroll to previous tools" title="Previous tools"
          disabled={!canPrevious} onClick={() => nudge(-1)}>
          <StudioIcon name="chevron" size={16} />
        </button>
        <div className="property-tabs maker-tab-scroller" role="tablist"
          aria-label="Creative tools" ref={scrollerRef}
          onScroll={updateEdges} onKeyDown={handleKeyDown}>
          {DRAWER_TABS.map((item) => (
            <button key={item.id} type="button"
              id={`studio-tab-${item.id}`} role="tab"
              aria-selected={value === item.id}
              aria-controls={`studio-panel-${item.id}`}
              tabIndex={value === item.id ? 0 : -1}
              className={value === item.id ? 'active' : ''}
              title={item.description}
              onClick={() => onChange(item.id)}>
              <StudioIcon name={item.icon} size={20} aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
        <button type="button" className="maker-tab-nudge maker-tab-next"
          aria-label="Scroll to next tools" title="Next tools"
          disabled={!canNext} onClick={() => nudge(1)}>
          <StudioIcon name="chevron" size={16} />
        </button>
      </div>
    </nav>
  );
}
