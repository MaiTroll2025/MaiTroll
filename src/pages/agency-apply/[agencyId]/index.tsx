import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { isUuid } from '../../../lib/validators';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { Loader } from '../../../components/ui/loader';
import { EmptyState } from '../../../components/ui/empty-state';
import { Checkbox } from '../../../components/ui/checkbox';
import { Textarea } from '../../../components/ui/textarea';
import { Input } from '../../../components/ui/input';

export default function AgencyApplyPage() {
  const { agencyIdOrSlug } = useParams<{ agencyIdOrSlug: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [agency, setAgency] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [userHasApplied, setUserHasApplied] = useState(false);
  const [userIsMember, setUserIsMember] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    message: '',
    content_type: '',
    live_schedule: '',
    battle_interest: false,
    social_links: '',
    agree_to_split: false
  });
  
  
  
  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchAgencyAndCheckStatus();
  }, [agencyIdOrSlug, navigate, user]);

  const fetchAgencyAndCheckStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      setAgency(null);
      setUserHasApplied(false);
      setUserIsMember(false);

      if (!agencyIdOrSlug) {
        setError('Missing agency id or slug.');
        return;
      }

      // Fetch agency info by ID or by slug/public_slug/agency_code/public_id
      let agencyData: any = null;

      if (isUuid(agencyIdOrSlug)) {
        const { data, error } = await supabase
          .from('agencies')
          .select('*')
          .eq('id', agencyIdOrSlug)
          .eq('status', 'approved')
          .maybeSingle();

        if (error) throw error;
        agencyData = data;
      } else {
        const { data: slugData, error: slugError } = await supabase
          .from('agencies')
          .select('*')
          .eq('slug', agencyIdOrSlug)
          .eq('status', 'approved')
          .maybeSingle();
        if (slugError) throw slugError;
        if (slugData) {
          agencyData = slugData;
        }

        if (!agencyData) {
          const { data: publicSlugData, error: publicSlugError } = await supabase
            .from('agencies')
            .select('*')
            .eq('public_slug', agencyIdOrSlug)
            .eq('status', 'approved')
            .maybeSingle();
          if (publicSlugError) throw publicSlugError;
          agencyData = publicSlugData;
        }

        if (!agencyData) {
          const { data: codeData, error: codeError } = await supabase
            .from('agencies')
            .select('*')
            .eq('agency_code', agencyIdOrSlug)
            .eq('status', 'approved')
            .maybeSingle();
          if (codeError) throw codeError;
          agencyData = codeData;
        }

        if (!agencyData) {
          const { data: publicIdData, error: publicIdError } = await supabase
            .from('agencies')
            .select('*')
            .eq('public_id', agencyIdOrSlug)
            .eq('status', 'approved')
            .maybeSingle();
          if (publicIdError) throw publicIdError;
          agencyData = publicIdData;
        }
      }

      if (!agencyData) {
        setError('Agency not found or not approved');
        return;
      }

      setAgency(agencyData);
      const resolvedAgencyId = agencyData?.id;
      if (!resolvedAgencyId) {
        setError('Resolved agency ID is missing.');
        return;
      }

      // Check if user is already a member
      const { data: memberData, error: memberError } = await supabase
        .from('agency_members')
        .select('id')
        .eq('agency_id', resolvedAgencyId)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      if (memberError) throw memberError;
      setUserIsMember(!!memberData);

      // Check if user has already applied
      const { data: applicationData, error: applicationError } = await supabase
        .from('agency_applications')
        .select('id')
        .eq('agency_id', resolvedAgencyId)
        .eq('applicant_id', user.id)
        .in('status', ['pending', 'approved'])
        .maybeSingle();

      if (applicationError) throw applicationError;
      setUserHasApplied(!!applicationData);
    } catch (err: any) {
      setError(err?.message || 'Failed to load agency information.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

   const handleSubmit = async (e: React.FormEvent) => {
     e.preventDefault();
     if (!user) return;

     try {
       // If user has already applied or is a member, don't allow submission
       if (userHasApplied || userIsMember) {
         setError('You have already applied or are a member of this agency');
         return;
       }

       // Validate required fields
       if (!formData.message.trim()) {
         setError('Please tell us why you want to join this agency');
         return;
       }
       if (!formData.content_type.trim()) {
         setError('Please tell us what type of content you broadcast');
         return;
       }
       if (!formData.live_schedule.trim()) {
         setError('Please tell us how often you plan to go live');
         return;
       }
       if (!formData.agree_to_split) {
         setError('You must agree to the agency split terms');
         return;
       }

       // Parse social links
       const parsedSocialLinks = formData.social_links
         ? JSON.parse(formData.social_links)
         : {};

       // Submit application via RPC
       const { data, error } = await supabase.rpc('submit_agency_application', {
         p_agency_ref: agency?.id,
         p_applicant_user_id: user.id,
         p_role: 'creator',
         p_answers: {
           content_type: formData.content_type,
           live_schedule: formData.live_schedule,
           battle_interest: formData.battle_interest,
           social_links: parsedSocialLinks
         },
         p_message: formData.message
       });

       if (error) throw error;

       if (!data.success) {
         throw new Error(data.message);
       }

       setSuccess(true);
       // Reset form or show success message
     } catch (err) {
       setError(err.message);
     }
   };

  if (loading) return <Loader />;
  if (error) return <div className="text-red-400 p-4">{error}</div>;
  if (success) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-8">
      <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-center min-h-screen">
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-8 text-center">
          <div className="text-cyan-400 mb-4 text-3xl">✅</div>
          <h2 className="text-xl font-semibold text-white mb-4">Application Submitted!</h2>
          <p className="text-slate-400 mb-6">
            Your application to join {agency?.name} has been submitted. The agency owners will review it shortly.
          </p>
          <Button 
            variant="outline" 
            className="px-6 py-2 bg-transparent border border-cyan-500/30 hover:bg-cyan-500/10"
            onClick={() => navigate(`/agency/${agencyId}`)}
          >
            View Agency
          </Button>
        </div>
      </div>
    </div>
  );

  if (userIsMember) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-8">
      <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-center min-h-screen">
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-8 text-center">
          <div className="text-yellow-400 mb-4 text-3xl">⚠️</div>
          <h2 className="text-xl font-semibold text-white mb-4">Already a Member</h2>
          <p className="text-slate-400 mb-6">
            You are already an active member of {agency?.name}.
          </p>
          <Button 
            variant="outline" 
            className="px-6 py-2 bg-transparent border border-cyan-500/30 hover:bg-cyan-500/10"
            onClick={() => navigate(`/agency-dashboard`)}
          >
            Go to Agency Dashboard
          </Button>
        </div>
      </div>
    </div>
  );

  if (!agency) return <div className="text-center py-8">Loading agency...</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-8">
      <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-8">
          <div className="flex items-center space-x-4 mb-6">
            {agency.logo_url ? (
              <img 
                src={agency.logo_url} 
                alt={`${agency.name} logo`} 
                className="w-12 h-12 rounded-full border-2 border-cyan-500/30"
              />
            ) : (
              <div className="w-12 h-12 rounded-full border-2 border-cyan-500/30 flex items-center justify-center bg-slate-700">
                <span className="text-cyan-400 font-bold">{agency.name.charAt(0)}</span>
              </div>
            )}
            <div>
              <h2 className="text-xl font-semibold text-white">{agency.name}</h2>
              <p className="text-sm text-slate-400">
                Talent Office • Owner: <span className="text-cyan-400">@{agency.owner_id === user.id ? 'You' : 'Loading...'}</span>
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-cyan-400 mb-3">Tell us about yourself</h3>
              <p className="text-sm text-slate-400 mb-2">
                Help the agency owners get to know you and your content.
              </p>
              <Textarea
                name="message"
                label="Why do you want to join this Talent Office?"
                placeholder="Share your goals, what you're looking for in an agency, and why you think this agency is a good fit for you..."
                value={formData.message}
                onChange={handleInputChange}
                minRows={4}
                required
              />
            </div>

            <div>
              <h3 className="text-lg font-semibold text-cyan-400 mb-3">Your Content & Schedule</h3>
              <GridContainer>
                <Item>
                  <Input
                    name="content_type"
                    label="What type of content do you broadcast?"
                    placeholder="e.g., Gaming, Music, Talk Show, Art, etc."
                    value={formData.content_type}
                    onChange={handleInputChange}
                    required
                  />
                </Item>
                <Item>
                  <Input
                    name="live_schedule"
                    label="How often do you plan to go live?"
                    placeholder="e.g., Daily, 3x/week, Weekends only, etc."
                    value={formData.live_schedule}
                    onChange={handleInputChange}
                    required
                  />
                </Item>
              </GridContainer>
            </div>

            <div>
              <div className="flex items-center space-x-3 mb-4">
                <Checkbox
                  name="battle_interest"
                  label="Are you interested in participating in agency battles?"
                  checked={formData.battle_interest}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-cyan-400 mb-3">Social Links (Optional)</h3>
              <p className="text-sm text-slate-400 mb-2">
                Share your social media profiles so the agency can learn more about you.
              </p>
              <Input
                name="social_links"
                label="Social Links (JSON format)"
                placeholder='{"twitter": "@yourtwitter", "instagram": "@yourinstagram", "tiktok": "@yourtiktok"}'
                value={formData.social_links}
                onChange={handleInputChange}
              />
            </div>

            <div className="border-t pt-6">
              <div className="flex items-center space-x-3 mb-4">
                <Checkbox
                  name="agree_to_split"
                  label="I understand and agree to the agency's default split of 10% of gift earnings (if applicable)"
                  checked={formData.agree_to_split}
                  onChange={handleInputChange}
                />
                <p className="text-sm text-slate-400">
                  The agency split applies only to gift earnings and must be accepted by you before it becomes active.
                </p>
              </div>
            </div>

            <div className="mt-6">
              <Button 
                variant="primary" 
                type="submit"
                className="w-full px-6 py-3"
                disabled={userHasApplied || userIsMember}
              >
                {userHasApplied || userIsMember ? 'Already Applied/Member' : 'Submit Application'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Helper components for layout
function GridContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {children}
    </div>
  );
}

function Item({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}