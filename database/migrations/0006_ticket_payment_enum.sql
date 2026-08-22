-- Migration to add 'Senior_Exemption' to payment_type enum for tickets

-- Attempt to add the value to the enum type.
-- Assuming the type name is "payment_type" based on Supabase UI inspection.
ALTER TYPE payment_type ADD VALUE IF NOT EXISTS 'Senior_Exemption';
