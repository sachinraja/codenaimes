'use client';

import { Button } from './ui/button';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Input } from './ui/input';

export function JoinRoomForm({ roomId }: { roomId: string }) {
  const [username, setUsername] = useState('');
  const router = useRouter();

  const handleJoinRoomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_WORKERS_HTTP_URL}/room/${roomId}/join`,
      {
        body: JSON.stringify({ username }),
        method: 'POST',
        credentials: 'include',
      },
    );

    if (!res.ok) return toast.error('Failed to join room');

    router.push(`/room/${roomId}`);
  };

  return (
    <form className="flex flex-col space-y-2" onSubmit={handleJoinRoomSubmit}>
      <Input
        type="text"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Enter a username..."
      />
      <Button type="submit" className="text-lg cursor-pointer">
        join room
      </Button>
    </form>
  );
}
