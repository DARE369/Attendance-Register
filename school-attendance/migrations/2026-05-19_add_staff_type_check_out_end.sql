-- Add an end time for staff check-out windows.
-- Run this in Supabase SQL Editor before saving staff type configs from the UI.

alter table staff_type_config
  add column if not exists check_out_end time not null default '18:00:00';

update staff_type_config
set check_out_end = check_out_time
where check_out_end is null;

comment on column staff_type_config.check_out_time is 'Start of the allowed check-out window.';
comment on column staff_type_config.check_out_end is 'End of the allowed check-out window.';
