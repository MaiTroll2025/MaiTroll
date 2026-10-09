import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getContractsByRecipient, getContractsBySender } from '../lib/tromail';

export const useGetContractsByRecipient = (recipientUserId) => {
  const _queryClient = useQueryClient();
  
  return useQuery({
    queryKey: ['contracts', 'recipient', recipientUserId],
    queryFn: () => getContractsByRecipient(recipientUserId),
    enabled: !!recipientUserId,
  });
};

export const useGetContractsBySender = (senderUserId) => {
  const _queryClient = useQueryClient();
  
  return useQuery({
    queryKey: ['contracts', 'sender', senderUserId],
    queryFn: () => getContractsBySender(senderUserId),
    enabled: !!senderUserId,
  });
};