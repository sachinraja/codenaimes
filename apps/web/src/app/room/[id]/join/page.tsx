import { JoinRoomForm } from '@/components/join-room-form';

export default async function Home({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id: roomId } = await params;

  return (
    <div className="flex flex-col items-center justify-center h-screen space-y-4">
      <h1 className="flex flex-row space-x-0.5 text-xl font-semibold">
        <span>coden</span>
        <span className="italic font-bold">AI</span>
        <span>mes</span>
      </h1>
      <JoinRoomForm roomId={roomId} />
    </div>
  );
}
