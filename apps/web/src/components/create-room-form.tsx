'use client';

import { Button } from './ui/button';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Input } from './ui/input';
import { createRoom } from '@/app/actions';

export function CreateRoomForm() {
  const [username, setUsername] = useState('');
  const router = useRouter();

  const handleCreateRoomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const roomId = await createRoom(username);
      router.push(`/room/${roomId}`);
    } catch {
      toast.error('Failed to create room');
    }
  };

  return (
    <div>
      <form
        className="flex flex-col space-y-2"
        onSubmit={handleCreateRoomSubmit}
      >
        <Input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Enter a username..."
        />
        <Button
          type="submit"
          className="text-lg cursor-pointer"
          disabled={!username.trim()}
        >
          create room
        </Button>
      </form>
    </div>
  );
}
