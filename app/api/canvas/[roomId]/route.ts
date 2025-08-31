import { NextRequest, NextResponse } from 'next/server';
import { getCanvasState, setCanvasState } from '@/lib/redis';

export async function GET(
  request: NextRequest,
  { params }: { params: { roomId: string } }
) {
  try {
    const { roomId } = params;
    
    if (!roomId) {
      return NextResponse.json(
        { error: 'Room ID is required' },
        { status: 400 }
      );
    }

    const state = await getCanvasState(roomId);
    
    return NextResponse.json({ 
      state: state ? JSON.parse(state as string) : null 
    });
  } catch (error) {
    console.error('Error getting canvas state:', error);
    return NextResponse.json(
      { error: 'Failed to get canvas state' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { roomId: string } }
) {
  try {
    const { roomId } = params;
    const { state } = await request.json();
    
    if (!roomId) {
      return NextResponse.json(
        { error: 'Room ID is required' },
        { status: 400 }
      );
    }

    if (!state) {
      return NextResponse.json(
        { error: 'Canvas state is required' },
        { status: 400 }
      );
    }

    const success = await setCanvasState(roomId, state);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Failed to save canvas state' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving canvas state:', error);
    return NextResponse.json(
      { error: 'Failed to save canvas state' },
      { status: 500 }
    );
  }
}