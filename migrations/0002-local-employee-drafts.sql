-- Existing employees keep their flow IDs. New drafts may be saved before Activepieces is provisioned.
ALTER TABLE siyadah_digital_employees ALTER COLUMN activepieces_flow_id DROP NOT NULL;
ALTER TABLE siyadah_digital_employees ADD COLUMN IF NOT EXISTS creation_request_id varchar(80);
CREATE UNIQUE INDEX IF NOT EXISTS siyadah_employees_creation_request_idx
  ON siyadah_digital_employees(company_id,creation_request_id);
