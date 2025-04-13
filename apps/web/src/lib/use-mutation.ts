import { useState } from 'react';

export function useMutation(
  mutator: () => Promise<void>,
  {
    onError,
  }: {
    onError?: (error: unknown) => void;
  } = {},
) {
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const mutate = async () => {
    setIsLoading(true);

    try {
      await mutator();
    } catch (err) {
      onError?.(err);
    } finally {
      setIsLoading(false);
    }
  };

  return { mutate, isLoading };
}
