-- Add 'steps' as a valid period type for program periods.
alter table program_periods
  drop constraint program_periods_period_type_check;

alter table program_periods
  add constraint program_periods_period_type_check
  check (period_type in ('week','day','month','quarter','steps','custom'));
