import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getUserDocuments } from '../lib/tromail';

export const useGetUserDocuments = (userId, filters) => {
  const _queryClient = useQueryClient();
  
  return useQuery({
    queryKey: ['userDocuments', userId, filters],
    queryFn: () => getUserDocuments(userId, filters),
    enabled: !!userId,
  });
};