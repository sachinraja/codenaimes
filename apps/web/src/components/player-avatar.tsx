import Avatar from 'boring-avatars';

export function PlayerAvatar({
  username,
  size,
}: { username: string; size?: number }) {
  return (
    <Avatar
      name={username}
      variant="beam"
      colors={['#3a3232', '#d83018', '#f07848', '#fdfcce', '#c0d8d8']}
      size={size}
    />
  );
}
