-- Run in: https://supabase.com/dashboard/project/hxmacphgbpedazdvgdnz/sql/new
-- Adds new columns to business_kyc for detailed global KYC

alter table business_kyc add column if not exists director_dob         text;
alter table business_kyc add column if not exists director_address     text;
alter table business_kyc add column if not exists director_id_type     text;
alter table business_kyc add column if not exists ubo_name             text;
alter table business_kyc add column if not exists ubo_ownership        text;
alter table business_kyc add column if not exists website              text;
alter table business_kyc add column if not exists incorporation_date   text;
