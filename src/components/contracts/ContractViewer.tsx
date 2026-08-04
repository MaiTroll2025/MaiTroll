import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuthStore } from '../../lib/store';
import { useGetContractById } from '../../hooks/useGetContractById';
import { useGetUserTromailAccount } from '../../hooks/useGetUserTromailAccount';
import { useSignContract } from '../../hooks/useSignContract';
import { useRejectContract } from '../../hooks/useRejectContract';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { useGetTromailRoleDirectory } from '../../hooks/useGetTromailRoleDirectory';

export const ContractViewer = () => {
  const { user } = useAuthStore();
  const { contractId } = useParams();
  const [contract, setContract] = useState(null);
  const [signature, setSignature] = useState('');
  const [legalName, setLegalName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigning, setIsSigning] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  const {
    data: contractData,
    isLoading: contractLoading
  } = useGetContractById(contractId);

  const {
    data: userAccountData,
    isLoading: accountLoading
  } = useGetUserTromailAccount(user?.id);

  const { signContractAsync } = useSignContract();
  const { rejectContractAsync } = useRejectContract();

  useEffect(() => {
    if (contractData) {
      setContract(contractData);
      setIsLoading(false);
    }
  }, [contractData]);

  useEffect(() => {
    if (userAccount && contract) {
      setLegalName(userAccount.display_name || userAccount.username || '');
    }
  }, [contract, userAccount]);

  const userAccount = userAccountData;

  if (isLoading || contractLoading) {
    return <div className="p-4 text-white">Loading contract...</div>;
  }

  if (!contract) {
    return <div className="p-4 text-white">Contract not found</div>;
  }

  if (contract.recipient_user_id !== userAccount?.id) {
    return <div className="p-4 text-white">You are not authorized to view this contract</div>;
  }

  if (contract.status === 'signed') {
    return (
      <div className="p-4 bg-slate-900 text-white min-h-screen">
        <h2 className="text-2xl font-bold mb-2">Contract Already Signed</h2>
        <p>This contract has already been signed and processed.</p>
      </div>
    );
  }

  if (contract.status === 'rejected') {
    return (
      <div className="p-4 bg-slate-900 text-white min-h-screen">
        <h2 className="text-2xl font-bold mb-2">Contract Rejected</h2>
        <p>This contract has been rejected and cannot be signed.</p>
      </div>
    );
  }

  const handleSignContract = async () => {
    if (!agreed) {
      alert('Please agree to the terms before signing');
      return;
    }
    
    if (!legalName.trim()) {
      alert('Please enter your legal name');
      return;
    }
    
    if (!signature.trim()) {
      alert('Please provide a signature');
      return;
    }
    
    setIsSigning(true);
    try {
      await signContractAsync({
        contractId,
        userId: userAccount.id,
        legalName,
        signatureText: signature
      });
      alert('Contract signed successfully!');
    } catch (error) {
      console.error('Error signing contract:', error);
      alert('Failed to sign contract. Please try again.');
    } finally {
      setIsSigning(false);
    }
  };

  const handleRejectContract = async () => {
    const reason = prompt('Please provide a reason for rejecting this contract (optional):');
    
    setIsRejecting(true);
    try {
      await rejectContractAsync({
        contractId,
        userId: userAccount.id,
        note: reason || ''
      });
      alert('Contract rejected');
    } catch (error) {
      console.error('Error rejecting contract:', error);
      alert('Failed to reject contract. Please try again.');
    } finally {
      setIsRejecting(false);
    }
  };

  return (
    <div className="p-4 bg-slate-900 text-white min-h-screen">
      <h2 className="text-2xl font-bold mb-4">Review Contract: {contract.role_label}</h2>
      
      <div className="p-4 bg-slate-800 rounded-lg mb-4">
        <p className="mb-2">Dear {userAccount?.display_name || userAccount?.username},</p>
        <p>You have been appointed as a {contract.role_label} for Mai Troll.</p>
        <p className="mt-2">Please review all terms carefully before signing.</p>
      </div>
      
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={agreed}
            onChange={e => setAgreed(e.target.checked)}
            id="agree"
            className="w-4 h-4"
          />
          <label htmlFor="agree">I have read and agree to all the terms and conditions of this contract</label>
        </div>
        
        {!agreed && (
          <p className="text-red-400 text-sm">You must agree to the terms before signing this contract</p>
        )}
        
        <div>
          <label className="block text-sm font-medium mb-1">Legal Name</label>
          <Input
            value={legalName}
            onChange={e => setLegalName(e.target.value)}
            placeholder="Enter your full legal name"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Signature</label>
          <Input
            value={signature}
            onChange={e => setSignature(e.target.value)}
            placeholder="Type your full legal name as your signature"
          />
        </div>
        
        <div className="flex gap-2 pt-4">
          <Button
            variant="outline"
            onClick={handleRejectContract}
            disabled={isRejecting}
          >
            Reject Contract
          </Button>
          <Button
            onClick={handleSignContract}
            disabled={isSigning || !agreed || !legalName || !signature}
          >
            Sign and Send Back
          </Button>
        </div>
      </div>
    </div>
  );
};