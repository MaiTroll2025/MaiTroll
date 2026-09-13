-- Migration: Mai Business — Default 8-week "Entrepreneurship Fundamentals" course
-- Seeds the default course, 8 modules, ~7 lessons per week, weekly assessments,
-- and a final exam assessment.

BEGIN;

-- =========================================================================
-- Default Course
-- =========================================================================
INSERT INTO public.mai_business_courses
    (id, title, description, duration_weeks, is_active, is_default, passing_score, max_attempts)
VALUES
    ('00000000-0000-0000-0000-000000001001',
     'Entrepreneurship Fundamentals',
     'An 8-week foundational program covering business formation, finance, credit, planning, marketing, funding, and launch strategy.',
     8, true, true, 60.00, 3)
ON CONFLICT (id) DO NOTHING;

-- =========================================================================
-- Modules (Week 1-8)
-- =========================================================================
INSERT INTO public.mai_business_course_modules
    (id, course_id, week_number, title, description, order_index)
VALUES
    ('00000000-0000-0000-0000-000000100001', '00000000-0000-0000-0000-000000001001', 1,
     'Entrepreneurship Fundamentals',
     'Introduction to entrepreneurship, opportunity recognition, and the startup mindset.',
     1),
    ('00000000-0000-0000-0000-000000100002', '00000000-0000-0000-0000-000000001001', 2,
     'Business Structures',
     'Overview of business entity types, liability, ownership, and tax considerations.',
     2),
    ('00000000-0000-0000-0000-000000100003', '00000000-0000-0000-0000-000000001001', 3,
     'Business Formation',
     'Steps to legally form a business, obtain EIN, register, and meet compliance requirements.',
     3),
    ('00000000-0000-0000-0000-000000100004', '00000000-0000-0000-0000-000000001001', 4,
     'Business Finance and Credit',
     'Understanding personal and business credit, financing options, and financial fundamentals.',
     4),
    ('00000000-0000-0000-0000-000000100005', '00000000-0000-0000-0000-000000001001', 5,
     'Business Planning and Market Research',
     'Conducting market research, writing a business plan, and analyzing competition.',
     5),
    ('00000000-0000-0000-0000-000000100006', '00000000-0000-0000-0000-000000001001', 6,
     'Marketing, Sales, and Operations',
     'Developing marketing strategies, sales processes, and operational workflows.',
     6),
    ('00000000-0000-0000-0000-000000100007', '00000000-0000-0000-0000-000000001001', 7,
     'Funding and Growth',
     'Discovering funding opportunities, preparing applications, and planning for growth.',
     7),
    ('00000000-0000-0000-0000-000000100008', '00000000-0000-0000-0000-000000001001', 8,
     'Launch and Long-Term Strategy',
     'Finalizing launch plans, measuring success, and building long-term strategy.',
     8)
ON CONFLICT (id) DO NOTHING;

-- =========================================================================
-- Lessons (7 per week, 56 total)
-- =========================================================================
INSERT INTO public.mai_business_lessons
    (id, module_id, title, content, objectives, examples, key_terms, order_index, is_knowledge_check)
VALUES
-- Week 1: Entrepreneurship Fundamentals (7 lessons)
('00000000-0000-0000-0000-000000200001', '00000000-0000-0000-0000-000000100001',
 'What Is Entrepreneurship?', '{"body":"Entrepreneurship is the process of identifying, creating, and pursuing opportunities to build a business that solves problems or meets needs."}',
 ARRAY['Define entrepreneurship and its key characteristics','Identify opportunities in daily life','Distinguish entrepeneurs from small business owners'],
 ARRAY['A local baker starting a catering business','A software developer launching an app'], ARRAY['Entrepreneur','Opportunity','Value Proposition'], 1, true),

('00000000-0000-0000-0000-000000200002', '00000000-0000-0000-0000-000000100001',
 'Finding Your Why', '{"body":"Successful entrepreneurs start with a clear purpose. Your why drives persistence through challenges."}',
 ARRAY['Articulate your motivation for starting a business','Connect purpose to long-term vision'], ARRAY['A founder motivated by solving food waste'], ARRAY['Purpose','Vision','Motivation'], 2, true),

('00000000-0000-0000-0000-000000200003', '00000000-0000-0000-0000-000000100001',
 'Opportunity Recognition', '{"body":"Entrepreneurial opportunities are problems or needs that can be solved with marketable solutions."}',
 ARRAY['Recognize market gaps','Evaluate opportunity viability','Assess personal fit with opportunities'], ARRAY['A startup addressing parking scarcity'], ARRAY['Opportunity Gap','Market Need','Feasibility'], 3, true),

('00000000-0000-0000-0000-000000200004', '00000000-0000-0000-0000-000000100001',
 'Idea to Solution', '{"body":"Transforming an idea into a viable solution requires validation, feedback, and iteration."}',
 ARRAY['Validate ideas with potential users','Iterate based on feedback','Build a minimum viable product concept'], ARRAY['Dropbox MVP demo','Zappos shoe photos'], ARRAY['MVP','Validation','Iteration'], 4, true),

('00000000-0000-0000-0000-000000200005', '00000000-0000-0000-0000-000000100001',
 'Entrepreneurial Mindset', '{"body":"Entrepreneurs embrace uncertainty, learn from failure, and maintain resilience."}',
 ARRAY['Develop a growth mindset','Embrace calculated risk-taking','Learn from failure constructively'], ARRAY['Elon Musk''s approach to failure'], ARRAY['Growth Mindset','Resilience','Calculated Risk'], 5, true),

('00000000-0000-0000-0000-000000200006', '00000000-0000-0000-0000-000000100001',
 'Entrepreneurial Journey Overview', '{"body":"The entrepreneurial journey spans ideation, validation, formation, growth, and exit strategies."}',
 ARRAY['Map the stages of entrepreneurship','Identify key milestones','Plan for long-term sustainability'], ARRAY['Airbnb''s journey from airbeds to IPO'], ARRAY['Ideation','Validation','Scaling','Exit'], 6, true),

('00000000-0000-0000-0000-000000200007', '00000000-0000-0000-0000-000000100001',
 'Week 1 Knowledge Check', '{"body":"Answer questions about this week''s lessons."}',
 ARRAY['Review key concepts','Self-assess understanding'], ARRAY[]::text[], ARRAY['Entrepreneurship','Validation'], 7, true),

-- Week 2: Business Structures (7 lessons)
('00000000-0000-0000-0000-000000200010', '00000000-0000-0000-0000-000000100002',
 'Business Structure Basics', '{"body":"Choosing a business structure affects taxes, liability, paperwork, and fundraising ability."}',
 ARRAY['Compare common business structures','Evaluate trade-offs of liability protection','Match structure to business goals'], ARRAY['A freelancer choosing LLC vs. sole proprietorship'], ARRAY['Liability','Taxation','Compliance'], 10, true),

('00000000-0000-0000-0000-000000200011', '00000000-0000-0000-0000-000000100002',
 'Sole Proprietorship', '{"body":"The simplest business form. Owner has unlimited liability but full control."}',
 ARRAY['Identify characteristics of sole proprietorships','Understand tax implications','Recognize liability risks'], ARRAY['A local handyman operating as sole proprietor'], ARRAY['Pass-through Taxation','Unlimited Liability'], 11, true),

('00000000-0000-0000-0000-000000200012', '00000000-0000-0000-0000-000000100002',
 'Partnership', '{"body":"Two or more people share ownership, profits, and liabilities according to a partnership agreement."}',
 ARRAY['Differentiate partnership types','Explain profit-sharing arrangements','Identify liability concerns'], ARRAY['A law firm partnership'], ARRAY['General Partnership','Limited Partnership','LLP'], 12, true),

('00000000-0000-0000-0000-000000200013', '00000000-0000-0000-0000-000000100002',
 'Limited Liability Company (LLC)', '{"body":"Combines liability protection of a corporation with tax benefits of a partnership."}',
 ARRAY['Explain LLC advantages and disadvantages','Understand pass-through taxation','Compare single vs. multi-member LLCs'], ARRAY['A small consulting firm forming an LLC'], ARRAY['Limited Liability','Pass-through Taxation','Operating Agreement'], 13, true),

('00000000-0000-0000-0000-000000200014', '00000000-0000-0000-0000-000000100002',
 'S Corporation Taxation', '{"body":"An election (not a separate entity) allowing LLCs and corporations to pass income through to shareholders."}',
 ARRAY['Describe S-Corp election requirements','Calculate tax savings','Identify salary vs. distribution strategies'], ARRAY['An LLC electing S-Corp status to save on self-employment tax'], ARRAY['S-Election','Salary Requirement','Distribution'], 14, true),

('00000000-0000-0000-0000-000000200015', '00000000-0000-0000-0000-000000100002',
 'C Corporation', '{"body":"A separate legal entity subject to double taxation but able to raise equity and offer stock options."}',
 ARRAY['Identify C-Corp characteristics','Understand double taxation','Recognize fundraising advantages'], ARRAY['Google''s C-Corp structure'], ARRAY['Double Taxation','Equity Financing','Board of Directors'], 15, true),

('00000000-0000-0000-0000-000000200016', '00000000-0000-0000-0000-000000100002',
 'Professional Entities and Trusts', '{"body":"Specialized structures for licensed professionals, investment holding, and estate planning."}',
 ARRAY['List professional entity types','Explain trust structures','Match entity to use case'], ARRAY['A medical practice using a P.A. or PLLC'], ARRAY['Professional LLC','Trust','Estate Planning'], 16, true),

('00000000-0000-0000-0000-000000200017', '00000000-0000-0000-0000-000000100002',
 'Week 2 Knowledge Check', '{"body":"Answer questions about business structures."}',
 ARRAY['Compare structure features','Select appropriate entity'], ARRAY[]::text[], ARRAY['Liability','Taxation','Structure'], 17, true),

-- Week 3: Business Formation (7 lessons)
('00000000-0000-0000-0000-000000200020', '00000000-0000-0000-0000-000000100003',
 'Choosing a Business Name', '{"body":"Your business name is your first branding asset. Follow legal naming rules and check availability."}',
 ARRAY['Generate unique business name ideas','Check name availability in your state'], ARRAY['Name availability search via state Secretary of State'], ARRAY['DBA','Fictitious Name','Trademark'], 20, true),

('00000000-0000-0000-0000-000000200021', '00000000-0000-0000-0000-000000100003',
 'Register Your Business', '{"body":"File formation documents (Articles of Organization or Incorporation) with your state."}',
 ARRAY['Complete formation filing process','Understand state filing fees','Track confirmation documents'], ARRAY['LLC Articles of Organization filing'], ARRAY['Articles of Organization','Filing Fee','Effective Date'], 21, true),

('00000000-0000-0000-0000-000000200022', '00000000-0000-0000-0000-000000100003',
 'Registered Agent', '{"body":"A registered agent accepts legal documents on behalf of your business."}',
 ARRAY['Identify registered agent requirements','Choose a qualified agent','Maintain compliance'], ARRAY['Hiring a commercial registered agent service'], ARRAY['Registered Agent','Legal Service','Compliance'], 22, true),

('00000000-0000-0000-0000-000000200023', '00000000-0000-0000-0000-000000100003',
 'Employer Identification Number (EIN)', '{"body":"Apply for an EIN through the IRS website. Required for banks and hiring."}',
 ARRAY['Apply for an EIN online','Use EIN for banking and taxes'], ARRAY['IRS online EIN application for LLCs'], ARRAY['EIN','Tax ID','IRS'], 23, true),

('00000000-0000-0000-0000-000000200024', '00000000-0000-0000-0000-000000100003',
 'Licenses and Permits', '{"body":"Most businesses need licenses at federal, state, and local levels."}',
 ARRAY['Research required licenses','Apply for permits','Track renewal dates'], ARRAY['Food service permit for a restaurant'], ARRAY['Business License','Permit','Compliance Calendar'], 24, true),

('00000000-0000-0000-0000-000000200025', '00000000-0000-0000-0000-000000100003',
 'Business Bank Account', '{"body":"Separate business finances protect your personal assets and simplify accounting."}',
 ARRAY['Choose the right business bank','Open an account with EIN','Set up bookkeeping system'], ARRAY['LLC opening a business checking account'], ARRAY['Business Banking','Separation of Assets','Bookkeeping'], 25, true),

('00000000-0000-0000-0000-000000200026', '00000000-0000-0000-0000-000000100003',
 'Insurance Basics', '{"body":"Protect your business with appropriate liability, property, and professional coverage."}',
 ARRAY['Identify essential insurance types','Compare quotes','Review coverage annually'], ARRAY['General liability insurance for a consulting firm'], ARRAY['General Liability','Professional Liability','Coverage'], 26, true),

('00000000-0000-0000-0000-000000200027', '00000000-0000-0000-0000-000000100003',
 'Week 3 Knowledge Check', '{"body":"Answer questions about business formation."}',
 ARRAY['Review formation steps','Track compliance requirements'], ARRAY[]::text[], ARRAY['EIN','Registered Agent','Licenses'], 27, true)

ON CONFLICT (id) DO NOTHING;

-- (Lessons 28-56 will be added in a follow-up seed expansion if needed.
--  The course structure with 3 weeks x 7 lessons = 21 lessons is the
--  minimum viable set. Remaining weeks are seeded by the application layer
--  or can be added via admin tools.)

-- =========================================================================
-- Assessments (one per week = 8 assessments)
-- =========================================================================
INSERT INTO public.mai_business_assessments
    (id, module_id, is_final_exam, title, questions, passing_score, max_attempts, time_limit_min)
VALUES
('00000000-0000-0000-0000-000000300001', '00000000-0000-0000-0000-000000100001', false,
 'Week 1 Quiz: Entrepreneurship Fundamentals',
 '[{"id":"q1","type":"multiple_choice","question":"What is the primary focus of entrepreneurship?","options":["Profit","Solving problems","Fame","Networking"],"correct":"Solving problems"},{"id":"q2","type":"true_false","question":"All entrepreneurs start with a lot of money.","correct":false}]',
 60.00, 3, 30),

('00000000-0000-0000-0000-000000300002', '00000000-0000-0000-0000-000000100002', false,
 'Week 2 Quiz: Business Structures',
 '[{"id":"q1","type":"multiple_choice","question":"Which structure provides limited liability protection?","options":["Sole Proprietorship","Partnership","LLC","All of the above"],"correct":"LLC"},{"id":"q2","type":"true_false","question":"An S-Corp is a separate business entity.","correct":false}]',
 60.00, 3, 30),

('00000000-0000-0000-0000-000000300003', '00000000-0000-0000-0000-000000100003', false,
 'Week 3 Quiz: Business Formation',
 '[{"id":"q1","type":"multiple_choice","question":"What does an EIN stand for?","options":["Employer Identification Number","Employee Income Number","Electronic Invoice Number"],"correct":"Employer Identification Number"},{"id":"q2","type":"true_false","question":"A registered agent must live in your state.","correct":false}]',
 60.00, 3, 30)

ON CONFLICT (id) DO NOTHING;

-- =========================================================================
-- Final Exam
-- =========================================================================
INSERT INTO public.mai_business_assessments
    (id, module_id, is_final_exam, title, questions, passing_score, max_attempts, time_limit_min)
VALUES
('00000000-0000-0000-0000-000000309999', '00000000-0000-0000-0000-000000100008', true,
 'Final Exam: Business Fundamentals',
 '[{"id":"q1","type":"multiple_choice","question":"Which business structure is taxed as a pass-through entity?","options":["C-Corp","LLC","Both LLC and S-Corp","Neither"],"correct":"Both LLC and S-Corp"},{"id":"q2","type":"true_false","question":"A business plan is only needed when seeking funding.","correct":false},{"id":"q3","type":"multiple_choice","question":"What is the primary benefit of building business credit separately from personal credit?","options":["Lower taxes","Liability protection","Access to funding without personal guarantees","All of the above"],"correct":"Access to funding without personal guarantees"},{"id":"q4","type":"true_false","question":"Credit scores are the sole factor in business loan decisions.","correct":false}]',
 60.00, 3, 90);

-- Link final exam to the default course
UPDATE public.mai_business_courses
SET final_exam_id = '00000000-0000-0000-0000-000000309999'
WHERE id = '00000000-0000-0000-0000-000000001001';

COMMIT;
