'use client';

import { useRoomController } from '@/features/room/use-room-controller';
import { RoomWorkspace } from '@/features/room/RoomWorkspace';

export default function BoardRoom() {
  const room = useRoomController();
  return <RoomWorkspace {...room} />;
}
