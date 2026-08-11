import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getContractTemplates, getContractTemplateById } from '../lib/tromail';

export const useGetContractTemplates = () => {
  const queryClient = useQueryClient();
  
  return useQuery({
    queryKey: ['contractTemplates'],
    queryFn: getContractTemplates,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useGetContractTemplateById = (templateId) => {
  return useQuery({
    queryKey: ['contractTemplate', templateId],
    queryFn: () => getContractTemplateById(templateId),
    enabled: !!templateId,
  });
};