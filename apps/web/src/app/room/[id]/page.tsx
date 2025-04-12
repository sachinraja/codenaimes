import { GameController } from '@/components/game-controller';
import { TextScreen } from '@/components/text-screen';
import { cookies } from 'next/headers';

export default async function Room({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = (await cookies()).get('sessionId')?.value;
  if (!sessionId) {
    return (
      <TextScreen>
        <p>Unauthorized.</p>
        <p>Have you joined the room?</p>
      </TextScreen>
    );
  }

  return <GameController roomId={id} sessionId={sessionId} />;
}
