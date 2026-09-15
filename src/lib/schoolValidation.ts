// School validation service
export interface Institution {
  id: string;
  name: string;
  type: string;
  country?: string;
  state_province?: string;
  city?: string;
  website_url?: string;
  is_active?: boolean;
}

export interface InstitutionDomain {
  id: string;
  institution_id: string;
  domain: string;
  is_verified: boolean;
  verification_source?: string;
}

export interface UserInstitutionVerification {
  id: string;
  user_id: string;
  institution_id: string;
  domain: string;
  status: string;
  verified_by?: string;
  verified_at?: string;
  rejection_reason?: string;
  expires_at?: string;
}

export interface ValidateEmailResult {
  email_valid: boolean;
  domain: string;
  institution_found: boolean;
  institution?: Institution;
  institution_type?: string;
  verification_source?: string;
  verification_status: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const validateInstitutionEmail = async (email: string): Promise<ValidateEmailResult> => {
  const result: ValidateEmailResult = {
    email_valid: false,
    domain: '',
    institution_found: false,
    verification_status: 'unknown'
  };

  if (!EMAIL_REGEX.test(email)) {
    return result;
  }
  result.email_valid = true;

  const domain = email.split('@')[1].toLowerCase();
  result.domain = domain;

  try {
    const response = await fetch(`/api/institutions/check-domain?domain=${encodeURIComponent(domain)}`);
    if (response.ok) {
      const data = await response.json();
      if (data.found) {
        result.institution_found = true;
        result.institution = data.institution;
        result.institution_type = data.institution_type;
        result.verification_source = data.verification_source;
        result.verification_status = 'verified';
      }
    }
  } catch (err) {
    console.error('Institution lookup failed:', err);
  }

  return result;
};

export const getInstitutionByDomain = async (domain: string): Promise<Institution | null> => {
  try {
    const response = await fetch(`/api/institutions/by-domain?domain=${encodeURIComponent(domain)}`);
    if (response.ok) {
      const data = await response.json();
      return data.institution || null;
    }
  } catch (err) {
    console.error('Failed to get institution:', err);
  }
  return null;
};

export const submitVerificationRequest = async (data: {
  institution_name: string;
  institution_email: string;
  institution_domain: string;
  description?: string;
}): Promise<{ success: boolean; ticket_id?: string; error?: string }> => {
  try {
    const response = await fetch('/api/support/verification-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await response.json();
    return result;
  } catch (err) {
    return { success: false, error: 'Failed to submit verification request' };
  }
};
