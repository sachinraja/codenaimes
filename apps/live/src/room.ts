const ID_LENGTH = 6;

export function generateRoomId() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  let code = '';
  for (let i = 0; i < ID_LENGTH; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    code += characters[randomIndex];
  }
  return code;
}
