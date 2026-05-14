create or replace function admin_get_business_kyc(p_status text default null)
returns setof business_kyc
language sql
security definer
as 'select * from business_kyc where (p_status is null or p_status = ''all'' or status = p_status) order by created_at desc';
