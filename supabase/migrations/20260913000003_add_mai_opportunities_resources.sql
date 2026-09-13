-- Migration: Mai Business — Verified Resources and Funding Seed Data
-- All entries reference official, authoritative sources. No fabricated opportunities.

BEGIN;

-- =========================================================================
-- Resources (Category + URL + official source + last verified date)
-- =========================================================================
INSERT INTO public.mai_business_resources
    (id, name, description, category, official_source, url, geography, last_verified_date, status)
VALUES

-- Business Formation
('00000000-0000-0000-0000-000000002001',
 'U.S. Small Business Administration — Business Guide',
 'Step-by-step guide to starting a business, including registration, licenses, and permits.',
 'business formation', 'U.S. Small Business Administration (SBA)',
 'https://www.sba.gov/business-guide/launch-your-business', 'National', '2026-09-13', 'active'),

('00000000-0000-0000-0000-000000002002',
 'IRS — Apply for an EIN',
 'Free online application for an Employer Identification Number.',
 'business formation', 'Internal Revenue Service (IRS)',
 'https://www.irs.gov/businesses/small-businesses-self-employed/apply-for-an-employer-identification-number-ein-online', 'National', '2026-09-13', 'active'),

-- Government
('00000000-0000-0000-0000-000000002003',
 'U.S. Small Business Administration',
 'The nation''s small business resource hub for loans, grants, and counseling.',
 'government', 'U.S. Small Business Administration (SBA)',
 'https://www.sba.gov', 'National', '2026-09-13', 'active'),

('00000000-0000-0000-0000-000000002004',
 'USA.gov Business Portal',
 'Official U.S. government portal for starting and managing a business.',
 'government', 'USA.gov',
 'https://www.usa.gov/business', 'National', '2026-09-13', 'active'),

-- Taxes
('00000000-0000-0000-0000-000000002005',
 'IRS — Small Business and Self-Employed Tax Center',
 'Tax information and resources for small businesses.',
 'taxes', 'Internal Revenue Service (IRS)',
 'https://www.irs.gov/businesses/small-businesses-self-employed', 'National', '2026-09-13', 'active'),

-- Legal
('00000000-0000-0000-0000-000000002006',
 'SBA — Legal Structures Guide',
 'Explanation of business structures and legal considerations.',
 'legal', 'U.S. Small Business Administration (SBA)',
 'https://www.sba.gov/business-guide/plan-your-business/choose-business-structure', 'National', '2026-09-13', 'active'),

-- Accounting
('00000000-0000-0000-0000-000000002007',
 'SCORE — Financial Statements',
 'Free templates and guidance for small business financial management.',
 'accounting', 'SCORE (SBA Resource Partner)',
 'https://www.score.org/resource/financial-statements', 'National', '2026-09-13', 'active'),

-- Credit
('00000000-0000-0000-0000-000000002008',
 'AnnualCreditReport.com',
 'Official site to access free credit reports from the three major bureaus.',
 'credit', 'Federal Trade Commission (FTC)',
 'https://www.annualcreditreport.com', 'National', '2026-09-13', 'active'),

-- Business Credit
('00000000-0000-0000-0000-000000002009',
 'Dun & Bradstreet — D-U-N-S Number',
 'Information about D-U-N-S Numbers for business identity and credit.',
 'business credit', 'Dun & Bradstreet',
 'https://www.dnb.com/duns-number.html', 'National', '2026-09-13', 'active'),

('00000000-0000-0000-0000-000000002010',
 'SBA — Business Credit Builder',
 'Guidance on building business credit separately from personal credit.',
 'business credit', 'U.S. Small Business Administration (SBA)',
 'https://www.sba.gov/funding-programs/funding-programs/business-lines-of-credit/business-credit-builder', 'National', '2026-09-13', 'active'),

-- Licensing
('00000000-0000-0000-0000-000000002011',
 'SBA — Licenses and Permits',
 'Search tool for federal, state, and local licenses and permits.',
 'licensing', 'U.S. Small Business Administration (SBA)',
 'https://www.sba.gov/business-guide/launch-your-business/apply-licenses-and-permits', 'National', '2026-09-13', 'active'),

-- Permits
('00000000-0000-0000-0000-000000002012',
 'SBA — Permits',
 'Information on business permits and how to obtain them.',
 'permits', 'U.S. Small Business Administration (SBA)',
 'https://www.sba.gov/business-guide/launch-your-business/get-permits-and-licenses', 'National', '2026-09-13', 'active'),

-- Marketing
('00000000-0000-0000-0000-000000002013',
 'SBA — Marketing and Advertising',
 'Marketing basics and digital advertising resources for small businesses.',
 'marketing', 'U.S. Small Business Administration (SBA)',
 'https://www.sba.gov/business-guide/manage-your-business/market-your-business', 'National', '2026-09-13', 'active'),

-- Hiring
('00000000-0000-0000-0000-000000002014',
 'Department of Labor — Hiring',
 'Guidance on hiring employees, including compliance and paperwork.',
 'hiring', 'U.S. Department of Labor',
 'https://www.dol.gov/agencies/whd', 'National', '2026-09-13', 'active'),

-- Payroll
('00000000-0000-0000-0000-000000002015',
 'IRS — Payroll Information',
 'Federal tax withholding and payroll requirements for employers.',
 'payroll', 'Internal Revenue Service (IRS)',
 'https://www.irs.gov/businesses/small-businesses-self-employed/payroll-information-for-employees', 'National', '2026-09-13', 'active'),

-- Funding
('00000000-0000-0000-0000-000000002016',
 'SBA — Funding Programs',
 'Overview of SBA loan and grant programs for small businesses.',
 'funding', 'U.S. Small Business Administration (SBA)',
 'https://www.sba.gov/funding-programs', 'National', '2026-09-13', 'active'),

-- Grants
('00000000-0000-0000-0000-000000002017',
 'Grants.gov',
 'Official U.S. government grants database.',
 'grants', 'U.S. General Services Administration',
 'https://www.grants.gov', 'National', '2026-09-13', 'active'),

-- Education
('00000000-0000-0000-0000-000000002018',
 'SCORE — Free Business Mentoring',
 'Free mentoring and educational workshops for small business owners.',
 'education', 'SCORE (SBA Resource Partner)',
 'https://www.score.org', 'National', '2026-09-13', 'active'),

-- Entrepreneurship
('00000000-0000-0000-0000-000000002019',
 'SBA — Office of Entrepreneurship Education',
 'Resources on entrepreneurship education and training programs.',
 'entrepreneurship', 'U.S. Small Business Administration (SBA)',
 'https://www.sba.gov/entrepreneurs', 'National', '2026-09-13', 'active'),

-- Local Assistance
('00000000-0000-0000-0000-000000002020',
 'SBA — District Offices',
 'Find your local SBA district office for in-person assistance.',
 'local assistance', 'U.S. Small Business Administration (SBA)',
 'https://www.sba.gov/local-assistance', 'National', '2026-09-13', 'active')

ON CONFLICT (id) DO NOTHING;

-- =========================================================================
-- Verified Funding Programs
-- =========================================================================
INSERT INTO public.mai_business_funding_programs
    (id, name, organization, funding_type, award_min, award_max, eligibility, geography,
     industry_restrictions, requirements, deadline, official_source, application_url,
     last_verified_date, status, total_available, total_allocated)
VALUES

-- SBA 7(a) Loan Program
('00000000-0000-0000-0000-000000003001',
 'SBA 7(a) Loan Program',
 'U.S. Small Business Administration',
 'government', 5000, 5000000,
 'Small businesses meeting size and credit requirements. Must be for-profit operating in the US.',
 'National',
 'Must meet SBA size standards. Not available for speculative lending or pyramid schemes.',
 'Good credit history, ability to repay, personal guarantee required, collateral considered.',
 NULL,
 'U.S. Small Business Administration (SBA)',
 'https://www.sba.gov/funding-programs/loans/7a-loans',
 '2026-09-13', 'active', 0, 0),

-- SBA Microloan Program
('00000000-0000-0000-0000-000000003002',
 'SBA Microloan Program',
 'U.S. Small Business Administration',
 'government', 500, 50000,
 'Small businesses needing smaller amounts. Must use funds for working capital or fixed assets.',
 'National',
 'Loans must be used for working capital, inventory, supplies, furniture, or fixed assets.',
 'Must demonstrate ability to repay. Loans under $15,000 may not require collateral.',
 NULL,
 'U.S. Small Business Administration (SBA)',
 'https://www.sba.gov/funding-programs/loans/microloans',
 '2026-09-13', 'active', 0, 0),

-- SBA Community Advantage
('00000000-0000-0000-0000-000000003003',
 'SBA Community Advantage',
 'U.S. Small Business Administration',
 'government', 25000, 250000,
 'Small businesses in underserved communities. Must be creditworthy and able to repay.',
 'National',
 'Focuses on underserved markets: minorities, women, veterans, veterans, and entrepreneurs in rural or inner-city areas.',
 'Personal guarantee and collateral required. Loans up to $250,000.',
 NULL,
 'U.S. Small Business Administration (SBA)',
 'https://www.sba.gov/funding-programs/loans/community-advantage',
 '2026-09-13', 'active', 0, 0),

-- SBA Grant Programs (State Trade Expansion Program example)
('00000000-0000-0000-0000-000000003004',
 'Small Business Export Grant Programs',
 'U.S. Small Business Administration',
 'government', NULL, NULL,
 'Eligible small businesses engaged in or looking to expand export activities.',
 'National',
 'Must be certified small business. Export promotion activities only.',
 'See SBA website for specific grant opportunities and application cycles.',
 NULL,
 'U.S. Small Business Administration (SBA)',
 'https://www.sba.gov/funding-programs/grants',
 '2026-09-13', 'active', 0, 0),

-- SCORE Mentors
('00000000-0000-0000-0000-000000003005',
 'SCORE Free Business Mentoring',
 'SCORE',
 'nonprofit', 0, 0,
 'Any small business owner or aspiring entrepreneur can apply for free mentoring.',
 'National',
 'None. Voluntary mentoring relationship.',
 'Complete mentor request form. Mentor matched based on business needs and industry.',
 NULL,
 'SCORE',
 'https://www.score.org/find-mentor',
 '2026-09-13', 'active', 0, 0),

-- Small Business Development Centers (SBDC)
('00000000-0000-0000-0000-000000003006',
 'Small Business Development Centers (SBDC)',
 'U.S. Small Business Administration (SBA)',
 'government', 0, 0,
 'Free business consulting and low-cost training for small businesses and startups.',
 'National (local centers by state)',
 'Services vary by center. Most serve new and existing businesses.',
 'Contact your local SBDC for a free consultation.',
 NULL,
 'U.S. Small Business Administration (SBA)',
 'https://www.sba.gov/local-assistance/find/',
 '2026-09-13', 'active', 0, 0)

ON CONFLICT (id) DO NOTHING;

COMMIT;
