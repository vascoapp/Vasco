-- Enrich jobs table with address, scheduling, financial, and work detail columns
ALTER TABLE jobs
  -- Address
  ADD COLUMN address_street text,
  ADD COLUMN address_city text,
  ADD COLUMN address_postcode text,
  ADD COLUMN address_country text DEFAULT 'NL',
  ADD COLUMN address_access_notes text,
  ADD COLUMN address_parking_notes text,
  -- Scheduling
  ADD COLUMN scheduled_date date,
  ADD COLUMN scheduled_start_time text,
  ADD COLUMN scheduled_end_time text,
  ADD COLUMN estimated_duration numeric,
  -- Financial
  ADD COLUMN quoted_amount numeric,
  ADD COLUMN agreed_amount numeric,
  -- Work details
  ADD COLUMN trade text,
  ADD COLUMN priority text DEFAULT 'normal',
  ADD COLUMN rooms_areas text[],
  ADD COLUMN specifications text,
  ADD COLUMN site_contact text,
  ADD COLUMN site_phone text,
  -- Timestamps
  ADD COLUMN completed_at timestamptz;
