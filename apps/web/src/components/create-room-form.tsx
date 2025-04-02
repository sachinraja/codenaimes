'use client';

import { Button } from './ui/button';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Input } from './ui/input';

export function CreateRoomForm() {
  const [username, setUsername] = useState('');
  const router = useRouter();

  const handleCreateRoomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_WORKERS_HTTP_URL}/create-room`,
      {
        body: JSON.stringify({ username }),
        method: 'POST',
        credentials: 'include',
      },
    );

    const data = await res.json();
    if (!data?.id) return toast.error('Failed to create room');

    router.push(`/room/${data.id}`);
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
        <Button type="submit" className="text-lg cursor-pointer">
          create room
        </Button>
      </form>
    </div>
  );
}
