import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../lib/store';
import { useGetUserDocuments } from '../../hooks/useGetUserDocuments';
import { useGetTromailRoleDirectory } from '../../hooks/useGetTromailRoleDirectory';
import { useGetUserTromailAccount } from '../../hooks/useGetUserTromailAccount';
import { UserSearchInput } from '../UserSearchDropdown';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select';
import { useGetContractById } from '../../hooks/useGetContractById';
import { useGetContractsBySender } from '../../hooks/useGetContracts';
import { useUploadOrganizationDocument } from '../../hooks/useUploadOrganizationDocument';

export const FileCabinet = () => {
  const { user } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  
  const [filters, setFilters] = useState({
    userId: '',
    document_type: '',
    visibility: '',
    status: ''
  });
  
  const [selectedUser, setSelectedUser] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedContract, setSelectedContract] = useState(null);
  const [contracts, setContracts] = useState([]);

  const {
    data: directoryData,
    isLoading: directoryLoading
  } = useGetTromailRoleDirectory();

  const {
    data: userAccountData,
    isLoading: accountLoading
  } = useGetUserTromailAccount(user?.id);

  const {
    data: documentsData,
    isLoading: documentsLoading,
    error: documentsError
  } = useGetUserDocuments(filters.userId, {
    document_type: filters.document_type || undefined,
    visibility: filters.visibility || undefined,
    status: filters.status || undefined
  });

  const {
    data: contractsData,
    isLoading: contractsLoading
  } = useGetContractsBySender(userAccountData?.id || '');

  const { mutateAsync: uploadDocumentAsync } = useUploadOrganizationDocument();

  useEffect(() => {
    if (documentsData) {
      setDocuments(documentsData);
      setIsLoading(false);
    }
  }, [documentsData]);

  useEffect(() => {
    if (contractsData) {
      setContracts(contractsData);
    }
  }, [contractsData]);

  const handleUserChange = (userId) => {
    setFilters(prev => ({ ...prev, userId }));
    setSelectedUser(userId ? directoryData?.find(u => u.id === userId) || null : null);
    
    // Reset other filters when user changes
    setFilters(prev => ({ ...prev, document_type: '', visibility: '', status: '' }));
  };

  const handleFilterChange = (filter, value) => {
    setFilters(prev => ({ ...prev, [filter]: value }));
  };

  const handleUploadDocument = async (file, metadata) => {
    if (!selectedUser) {
      alert('Please select a user first');
      return;
    }

    setUploading(true);
    try {
      const fileUrl = `https://example.com/uploads/${file.name}`;
      const storagePath = `organization-files/users/${selectedUser.id}/${metadata.document_type}/${file.name}`;

      await uploadDocumentAsync({
        user_id: selectedUser.id,
        uploaded_by: userAccountData?.id || '',
        document_type: metadata.document_type,
        document_title: metadata.document_title || file.name,
        file_url: fileUrl,
        storage_path: storagePath,
        source: metadata.source || 'manual_upload',
        related_contract_id: selectedContract?.id || null,
        visibility: metadata.visibility || 'user_and_admin'
      });

      setIsLoading(true);
      
      alert('Document uploaded successfully!');
    } catch (error) {
      console.error('Error uploading document:', error);
      alert('Failed to upload document. Please try again.');
    } finally {
      setUploading(false);
      setUploadDialogOpen(false);
    }
  };

  if (directoryLoading || accountLoading || documentsLoading || contractsLoading) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div className="p-4 bg-slate-900 text-white min-h-screen">
      <h2 className="text-2xl font-bold mb-2">Organization File Cabinet</h2>
      <p className="text-gray-400 mb-4">Manage and organize documents for Mai Troll users</p>
      
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Select User</h3>
          <Input
            placeholder="Search for user..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          <UserSearchInput
            query={searchQuery}
            onSelect={handleUserChange}
            disableNavigation={true}
          />
          {selectedUser && (
            <p className="text-sm text-gray-400 mt-1">
              Selected: {selectedUser.display_name || selectedUser.username}
            </p>
          )}
        </div>
        
        {selectedUser && documents.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-2">
              Documents for {selectedUser.display_name || selectedUser.username}
            </h3>
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left p-2">Title</th>
                  <th className="text-left p-2">Type</th>
                  <th className="text-left p-2">Date</th>
                  <th className="text-left p-2">Visibility</th>
                </tr>
              </thead>
              <tbody>
                {documents.map(doc => (
                  <tr key={doc.id} className="border-b border-gray-800">
                    <td className="p-2">{doc.document_title}</td>
                    <td className="p-2 text-gray-400">
                      {doc.document_type.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </td>
                    <td className="p-2 text-gray-400">
                      {new Date(doc.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-2">
                      <span className={doc.visibility === 'admin_only' ? 'text-red-400' : 'text-green-400'}>
                        {doc.visibility.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {selectedUser && (
          <Button
            onClick={() => setUploadDialogOpen(true)}
            disabled={uploading}
          >
            Upload Document
          </Button>
        )}
      </div>
    </div>
  );
};