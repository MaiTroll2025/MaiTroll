-- Grant usage on the schema to the authenticated role
GRANT USAGE ON SCHEMA public TO authenticated;

-- Grant insert and select permissions on the property_types table to the authenticated role
GRANT INSERT, SELECT ON TABLE public.property_types TO authenticated;

-- Grant usage on the schema to the postgres role
GRANT USAGE ON SCHEMA public TO postgres;

-- Grant insert and select permissions on the property_types table to the postgres role
GRANT INSERT, SELECT ON TABLE public.property_types TO postgres;
