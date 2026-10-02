-- Siyadah owns early-access requests. The public browser never receives an
-- execution-provider URL or database credential.
CREATE TABLE IF NOT EXISTS siyadah_public_waitlist (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email varchar(254) NOT NULL UNIQUE,
  name varchar(120) NOT NULL,
  country_code varchar(8) NOT NULL,
  phone varchar(40) NOT NULL,
  company varchar(160) NOT NULL DEFAULT '',
  role varchar(80) NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
