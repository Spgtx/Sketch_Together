# SketchTogether - Real-time Collaborative Whiteboard

A powerful and simple, real-time collaborative whiteboard application built with Next.js, Fabric.js, Ably, and Upstash Redis.

## Features

- 🎨 **Rich Drawing Tools**: Pencil, rectangles, circles with color selection
- 👥 **Real-time Collaboration**: Multiple users can draw simultaneously
- 🖱️ **Live Cursors**: See other users' mouse positions in real-time
- 💾 **Canvas Persistence**: All drawings are automatically saved and restored
- 📱 **Responsive Design**: Works on desktop and tablet devices
- 🔗 **Shareable Links**: No signup required, just share the room URL
- ⚡ **Instant Setup**: Create a new board with one click

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Canvas Library**: Fabric.js
- **Real-time Communication**: Ably
- **State Persistence**: Upstash Redis
- **Styling**: Tailwind CSS + Shadcn/UI
- **Language**: TypeScript
- **Deployment**: Vercel-ready

## Getting Started

### Prerequisites

1. Node.js 18+ installed
2. An Ably account for real-time features
3. An Upstash Redis database for persistence

### Environment Setup

1. **Get Ably API Key**:
   - Go to [Ably Dashboard](https://ably.com/dashboard)
   - Sign up for a free account
   - Create a new app or use an existing one
   - Go to API Keys tab and copy your Root API key

2. **Get Upstash Redis Credentials**:
   - Go to [Upstash Console](https://console.upstash.com/redis)
   - Sign up for a free account
   - Create a new Redis database
   - Copy the REST URL and REST Token from the database details

3. **Configure Environment Variables**:
   - Copy `.env.local.example` to `.env.local`
   - Fill in your actual API keys:

   ```bash
   NEXT_PUBLIC_ABLY_KEY=your_ably_api_key_here
   UPSTASH_REDIS_REST_URL=your_upstash_redis_rest_url_here
   UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_rest_token_here
   ```

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Spgtx/SketchTogether.git
   cd sketchtogether
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

## Usage

1. **Create a New Board**:
   - Visit the homepage
   - Click "Create New Board"
   - You'll be redirected to a unique room

2. **Collaborate**:
   - Share the room URL with others
   - Everyone can draw simultaneously
   - See live cursors and drawings in real-time

3. **Drawing Tools**:
   - **Pencil**: Free-hand drawing
   - **Rectangle**: Click to add rectangles
   - **Circle**: Click to add circles
   - **Line**: Click to add straight Lines
   - **Arrow**: Click to add arrows
   - **Hand**: Click to select Objects
   - **Colors**: Choose from 6 different colors
   - **Clear/Delete**: Clear the entire canvas

## API Routes

- `GET /api/canvas/[roomId]`: Get saved canvas state for a room
- `POST /api/canvas/[roomId]`: Save canvas state for a room

## Project Structure

```
├── app/
│   ├── api/canvas/[roomId]/     # Canvas persistence API
│   ├── room/[roomId]/           # Whiteboard room page
│   ├── layout.tsx               # Root layout with Ably provider
│   └── page.tsx                 # Homepage
├── lib/
│   ├── ably.ts                  # Ably configuration
│   ├── redis.ts                 # Redis utilities
│   └── utils.ts                 # Utility functions
├── components/ui/               # Shadcn/UI components
├── .env.local.example           # Environment variables template
└── README.md                    # This file
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit your changes: `git commit -am 'Add feature'`
4. Push to the branch: `git push origin feature-name`
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

If you encounter any issues or have questions:

1. Check the GitHub Issues page
2. Ensure all environment variables are correctly configured
3. Verify your Ably and Upstash accounts are set up properly
4. Check the browser console for any errors

---

Built using Next.js, Fabric.js, Ably, and Upstash Redis.