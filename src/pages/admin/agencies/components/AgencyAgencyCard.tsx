import React from 'react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { useNavigate } from 'react-router-dom';

interface AgencyAgencyCardProps {
  agency: {
    id: string;
    name: string;
    slug: string;
    bio: string | null;
    logo_url: string | null;
    banner_url: string | null;
    status: string;
    default_split_percent: number;
    owner_id: string;
    owner: {
      username: string;
    };
    members_count: number;
    creators_count: number;
    created_at: string;
  };
  onStatusChange: (agencyId: string, newStatus: string) => void;
  onRemoveCreator: (agencyId: string, creatorId: string) => void;
}

export default function AgencyAgencyCard({ 
  agency, 
  onStatusChange, 
  onRemoveCreator: _onRemoveCreator 
}: AgencyAgencyCardProps) {
  const navigate = useNavigate();
  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
    approved: 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30',
    suspended: 'bg-red-500/20 text-red-400 border border-red-500/30',
    denied: 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 overflow-hidden hover:shadow-xl transition-shadow duration-300">
      {agency.banner_url && (
        <div className="h-24 bg-cover bg-center" style={{ backgroundImage: `url(${agency.banner_url})` }}></div>
      )}
      
      <div className="p-4">
        <div className="flex items-center space-x-3 mb-2">
          {agency.logo_url ? (
            <img 
              src={agency.logo_url} 
              alt={`${agency.name} logo`} 
              className="w-10 h-10 rounded-full border-2 border-cyan-500/30"
            />
          ) : (
            <div className="w-10 h-10 rounded-full border-2 border-cyan-500/30 flex items-center justify-center bg-slate-700">
              <span className="text-cyan-400 font-bold">{agency.name.charAt(0)}</span>
            </div>
          )}
          <div>
            <h3 className="text-lg font-semibold text-white">{agency.name}</h3>
            <p className="text-sm text-slate-400">
              Owner: <span className="text-cyan-400">@{agency.owner.username}</span>
            </p>
          </div>
        </div>

        {agency.bio && (
          <p className="text-slate-300 line-clamp-2 mb-3">
            {agency.bio}
          </p>
        )}

        <div className="flex flex-wrap gap-2 mb-4">
          <span className={`px-2 py-1 text-xs rounded-full ${statusColors[agency.status]}`}>
            {agency.status.charAt(0).toUpperCase() + agency.status.slice(1)}
          </span>
          <Badge variant="outline" className="text-cyan-400 border-cyan-500/30">
            👥 {agency.members_count} Members
          </Badge>
          <Badge variant="outline" className="text-purple-400 border-purple-500/30">
            🎨 {agency.creators_count} Creators
          </Badge>
          <Badge variant="outline" className="text-blue-400 border-blue-500/30">
            💰 {agency.default_split_percent}% Split
          </Badge>
        </div>

        <div className="flex justify-between items-center mt-4">
          <div className="flex-1 space-x-3">
            <Button 
              variant="outline" 
              size="sm"
              className="px-3 py-1 bg-transparent border border-cyan-500/30 hover:bg-cyan-500/10 text-sm"
              onClick={() => {
                navigate(`/agency/${agency.slug || agency.id}`);
              }}
            >
              Edit
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              className="px-3 py-1 bg-transparent border border-cyan-500/30 hover:bg-cyan-500/10 text-sm"
              onClick={() => {
                navigate(`/agency/${agency.slug || agency.id}`);
              }}
            >
              View
            </Button>
          </div>
          
          <div className="flex space-x-2">
            {/* Status change buttons */}
            {agency.status !== 'approved' && (
              <Button 
                variant="outline" 
                size="sm"
                className="px-3 py-1 bg-transparent border border-cyan-500/30 hover:bg-cyan-500/10 text-sm"
                onClick={() => onStatusChange(agency.id, 'approved')}
              >
                Approve
              </Button>
            )}
            
            {agency.status !== 'denied' && (
              <Button 
                variant="outline" 
                size="sm"
                className="px-3 py-1 bg-transparent border border-red-500/30 hover:bg-red-500/30 text-sm"
                onClick={() => onStatusChange(agency.id, 'denied')}
              >
                Deny
              </Button>
            )}
            
            {agency.status !== 'suspended' && (
              <Button 
                variant="outline" 
                size="sm"
                className="px-3 py-1 bg-transparent border border-yellow-500/30 hover:bg-yellow-500/30 text-sm"
                onClick={() => onStatusChange(agency.id, 'suspended')}
              >
                Suspend
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}