'use client';

import { Button } from './ui/button';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export function CreateRoomButton() {
  const router = useRouter();

  return (
    <Button
      className="text-lg cursor-pointer"
      onClick={async () => {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_WORKERS_HTTP_URL}/create-room`,
          {
            method: 'POST',
          },
        );

        const data = await res.json();
        if (!data?.id) return toast.error('Failed to create room');

        router.push(`/room/${data.id}`);
      }}
    >
      create room
    </Button>
  );
}
