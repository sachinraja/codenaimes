import { GameController } from '@/components/game-controller';

export default async function Room({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return <GameController roomId={id} />;
}
