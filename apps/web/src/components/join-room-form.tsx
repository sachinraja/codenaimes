'use client';

import { Button } from './ui/button';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Input } from './ui/input';
import { joinRoom } from '@/app/actions';
import { PlayerAvatar } from './player-avatar';

export function JoinRoomForm({ roomId }: { roomId: string }) {
  const [username, setUsername] = useState('');
  const router = useRouter();

  const handleJoinRoomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await joinRoom(roomId, username);
      router.push(`/room/${roomId}`);
    } catch {
      toast.error('Failed to join room');
    }
  };

  return (
    <form className="flex flex-col space-y-2" onSubmit={handleJoinRoomSubmit}>
      <div className="flex items-center space-x-2">
        <PlayerAvatar username={username} size={36} />
        <Input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Enter a username..."
        />
      </div>
      <Button
        type="submit"
        className="text-lg cursor-pointer"
        disabled={!username.trim()}
      >
        join room
      </Button>
    </form>
  );
}
