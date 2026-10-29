'use client';

import type { ConnectorRoute } from '@/lib/connector-geometry';

export function ConnectorPicker(props: {
  route: ConnectorRoute;
  onChange: (value: ConnectorRoute) => void;
}) {
  return (
    <div className="connector-picker-wrap">
      <img
        src="/art/room/connector-companions.svg"
        alt="Two doodle characters connected by a smart arrow"
        className="connector-doodle"
      />
      <div className="connector-style-picker" role="group" aria-label="Connector routing">
        {(['straight', 'elbow'] as const).map((route) => (
          <button
            key={route}
            type="button"
            className={props.route === route ? 'active' : ''}
            aria-pressed={props.route === route}
            onClick={() => props.onChange(route)}
          >
            <svg viewBox="0 0 70 32" aria-hidden="true" fill="none">
              <rect x="1" y="2" width="18" height="14" rx="3" />
              <rect x="51" y="17" width="18" height="14" rx="3" />
              {route === 'straight' ? (
                <path d="M19 9 51 24m-8-1 8 1-5-7" />
              ) : (
                <path d="M19 9h17v15h15m-7-5 7 5-7 5" />
              )}
            </svg>
            <span>{route === 'straight' ? 'Direct' : 'Elbow'}</span>
          </button>
        ))}
        <p>Drag from one shape to another. The connection follows both objects.</p>
      </div>
    </div>
  );
}
