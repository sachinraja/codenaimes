import { CreateRoomButton } from '@/components/create-room-button';

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center h-screen space-y-4">
      <h1 className="flex flex-row space-x-0.5 text-xl font-semibold">
        <span>coden</span>
        <span className="italic font-bold">AI</span>
        <span>mes</span>
      </h1>
      <CreateRoomButton />
    </div>
  );
}
