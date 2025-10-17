# SketchTogether - Real-time Collaborative Whiteboard

A powerful and simple, real-time collaborative whiteboard application built with Next.js, Fabric.js, Ably, and Upstash Redis.

## Features

- **Rich Drawing Tools**: Pencil, rectangles, circles with color selection
- **Real-time Collaboration**: Multiple users can draw simultaneously
- **Live Cursors**: See other users' mouse positions in real-time
- **Canvas Persistence**: All drawings are automatically saved and restored
- **Responsive Design**: Works on desktop and tablet devices
- **Shareable Links**: No signup required, just share the room URL
- **Instant Setup**: Create a new board with one click

## Getting Started

### Prerequisites

1. Node.js 18+ installed
2. An Ably account for real-time features
3. An Upstash Redis database for persistence

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Spgtx/Sketch_Together.git
   cd Sketch_Together
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser