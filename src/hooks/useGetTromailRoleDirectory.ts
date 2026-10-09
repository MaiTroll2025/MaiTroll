import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getTromailRoleDirectory } from '../lib/tromail';

export const useGetTromailRoleDirectory = () => {
  const _queryClient = useQueryClient();

  return useQuery({
    queryKey: ['tromailRoleDirectory'],
    queryFn: () => getTromailRoleDirectory(),
  });
};