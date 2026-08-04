import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { useGetUserTromailAccount } from '../../hooks/useGetUserTromailAccount';
import { UserSearchInput } from '../UserSearchDropdown';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select';
import { useGetContractTemplates } from '../../hooks/useGetContractTemplates';
import { useGetTromailRoleDirectory } from '../../hooks/useGetTromailRoleDirectory';

export const ContractCreator = () => {
  const { user } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('')
  
  const [formData, setFormData] = useState({
    recipient_user_id: '',
    role_key: '',
    pay_terms: '',
    start_date: '',
    contract_type: '',
    expiration_date: '',
    duties_responsibilities: '',
    confidentiality_clause: '',
    platform_rules: '',
    payout_method_notes: '',
    custom_notes: ''
  });
  
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [preview, setPreview] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [recipientProfile, setRecipientProfile] = useState(null);
  const [userAccount, setUserAccount] = useState(null);

  const {
    data: templatesData,
    isLoading: templatesLoading
  } = useGetContractTemplates();

  const {
    data: userAccountData,
    isLoading: accountLoading
  } = useGetUserTromailAccount(user?.id);

  const {
    data: directoryData,
    isLoading: directoryLoading
  } = useGetTromailRoleDirectory();

  useEffect(() => {
    if (templatesData) {
      setTemplates(templatesData);
    }
  }, [templatesData]);

  useEffect(() => {
    if (userAccountData) {
      setUserAccount(userAccountData);
    }
  }, [userAccountData]);

  useEffect(() => {
    if (selectedTemplate && formData.recipient_user_id && recipientProfile) {
      generatePreview();
    }
  }, [selectedTemplate, formData, recipientProfile]);

  const handleTemplateChange = (templateId) => {
    const template = templates?.find(t => t.id === templateId);
    setSelectedTemplate(template);
    
    if (template) {
      setFormData(prev => ({
        ...prev,
        role_key: template.role_key
      }));
    }
  };

  const handleRecipientChange = (userId) => {
    setFormData(prev => ({ ...prev, recipient_user_id: userId }));
    
    if (userId) {
      fetchRecipientProfile(userId);
    } else {
      setRecipientProfile(null);
    }
  };

  const fetchRecipientProfile = async (userId) => {
    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('id, username, display_name, avatar_url, tromail_address')
        .eq('id', userId)
        .single();
      
      setRecipientProfile(data);
    } catch (error) {
      console.error('Error fetching recipient profile:', error);
    }
  };

  const handleFieldChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const generatePreview = async () => {
    if (!selectedTemplate || !recipientProfile) return;
    
    try {
      const previewData = {
        user_name: recipientProfile.display_name || recipientProfile.username || 'User',
        tromail_address: recipientProfile.tromail_address || '',
        role_label: selectedTemplate.role_label,
        start_date: formData.start_date || '',
        pay_terms: formData.pay_terms || '',
        admin_name: userAccount?.display_name || 'MaiTroll Administration',
        company_name: 'MaiTroll / MAI Corp',
        date: new Date().toLocaleDateString(),
        duties_responsibilities: formData.duties_responsibilities || '',
        confidentiality_clause: formData.confidentiality_clause || '',
        platform_rules: formData.platform_rules || '',
        payout_method_notes: formData.payout_method_notes || '',
        custom_notes: formData.custom_notes || ''
      };
      
      setPreview(previewData);
    } catch (error) {
      console.error('Error generating preview:', error);
    }
  };

  const handleSendContract = async () => {
    setIsSending(true);
    try {
      console.log('Sending contract:', formData);
    } catch (error) {
      console.error('Error sending contract:', error);
    } finally {
      setIsSending(false);
    }
  };

  if (templatesLoading || accountLoading || directoryLoading) {
    return <div className="p-4 text-white">Loading...</div>;
  }

  return (
    <div className="p-4 bg-slate-900 text-white min-h-screen">
      <h2 className="text-2xl font-bold mb-2">Contract Creator</h2>
      <p className="text-gray-400 mb-4">Create and send official role contracts</p>
      
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-2">Recipient</h3>
          <Input
            placeholder="Search for user..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          <UserSearchInput
            query={searchQuery}
            onSelect={handleRecipientChange}
            disableNavigation={true}
          />
          {recipientProfile && (
            <p className="text-sm text-gray-400 mt-1">
              Selected: {recipientProfile.display_name || recipientProfile.username}
            </p>
          )}
        </div>
        
        <div>
          <h3 className="text-lg font-semibold mb-2">Contract Template</h3>
          <Select value={selectedTemplate?.id || ''} onValueChange={handleTemplateChange}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a role template" />
            </SelectTrigger>
            <SelectContent>
              {templates?.map(t => (
                <SelectItem key={t.id} value={t.id}>
                  {t.role_label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Pay Terms</label>
            <Input
              value={formData.pay_terms}
              onChange={e => handleFieldChange('pay_terms', e.target.value)}
              placeholder="e.g., $500 per week"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Start Date</label>
            <Input
              type="date"
              value={formData.start_date}
              onChange={e => handleFieldChange('start_date', e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Duties & Responsibilities</label>
          <Textarea
            value={formData.duties_responsibilities}
            onChange={e => handleFieldChange('duties_responsibilities', e.target.value)}
            rows={4}
            placeholder="Describe the duties and responsibilities..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Confidentiality Clause</label>
          <Textarea
            value={formData.confidentiality_clause}
            onChange={e => handleFieldChange('confidentiality_clause', e.target.value)}
            rows={3}
            placeholder="Enter confidentiality clause..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Platform Rules</label>
          <Textarea
            value={formData.platform_rules}
            onChange={e => handleFieldChange('platform_rules', e.target.value)}
            rows={3}
            placeholder="Enter platform rules..."
          />
        </div>

        {preview && (
          <div>
            <h3 className="text-lg font-semibold mb-2">Contract Preview</h3>
            <div className="p-4 bg-slate-800 rounded-lg">
              <p className="mb-2">Dear {preview.user_name},</p>
              <p>You have been appointed as a {preview.role_label} for Mai Troll.</p>
              <p className="mt-2">Pay Terms: {preview.pay_terms}</p>
              <p>Start Date: {preview.start_date}</p>
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-4">
          <Button
            onClick={handleSendContract}
            disabled={isSending || !selectedTemplate || !recipientProfile}
          >
            Send Contract
          </Button>
        </div>
      </div>
    </div>
  );
};