'use client';

import { Button } from './ui/button';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Input } from './ui/input';
import { createRoom } from '@/app/actions';
import { PlayerAvatar } from './player-avatar';

export function CreateRoomForm() {
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleCreateRoomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setIsLoading(true);
      const roomId = await createRoom(username);
      router.push(`/room/${roomId}`);
    } catch {
      toast.error('Failed to create room');
    }
    setIsLoading(false);
  };

  return (
    <div>
      <form
        className="flex flex-col space-y-2"
        onSubmit={handleCreateRoomSubmit}
      >
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
          disabled={!username.trim() || isLoading}
        >
          create room
        </Button>
      </form>
    </div>
  );
}
