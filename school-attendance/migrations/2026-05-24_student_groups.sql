-- Student Groups: admin-managed list of named groups with associated transport mode.
-- The group_tag on students is a foreign key reference to this table's name column.

CREATE TABLE IF NOT EXISTS student_groups (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name           TEXT        NOT NULL UNIQUE,
    transport_mode VARCHAR(20) NOT NULL DEFAULT 'parent_drop',
    description    TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT student_groups_transport_mode_check
        CHECK (transport_mode IN ('parent_drop', 'school_bus', 'self'))
);

ALTER TABLE student_groups DISABLE ROW LEVEL SECURITY;

-- Seed sensible defaults
INSERT INTO student_groups (name, transport_mode, description) VALUES
    ('Bus Group A',    'school_bus',  'School bus - Route A'),
    ('Bus Group B',    'school_bus',  'School bus - Route B'),
    ('Parent Drop-off','parent_drop', 'Students dropped off by a parent or guardian'),
    ('Walkers',        'self',        'Students who walk or come to school alone')
ON CONFLICT (name) DO NOTHING;
