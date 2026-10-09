import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getUserTromailAccount } from '../lib/tromail';

export const useGetUserTromailAccount = (userId) => {
  const _queryClient = useQueryClient();
  
  return useQuery({
    queryKey: ['tromailAccount', userId],
    queryFn: () => getUserTromailAccount(userId),
    enabled: !!userId,
  });
};