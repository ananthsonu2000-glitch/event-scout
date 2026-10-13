-- 'exact' = a confirmed day. 'month' = only the month is known (tentative), event_date holds the 1st of that month.
alter table events add column if not exists date_precision text not null default 'exact' check (date_precision in ('exact', 'month'));
