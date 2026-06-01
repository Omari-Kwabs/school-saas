-- extend_schema15: Designate a class teacher per class
-- class_teacher_id points to the user who is the official class teacher
-- for that class. Used to:
--   • auto-fill class teacher name on terminal cards
--   • gate class_teacher_remark writes (only that user or admins)
--   • give class_teacher role users broader visibility for their own class

ALTER TABLE classes
  ADD COLUMN IF NOT EXISTS class_teacher_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_classes_class_teacher ON classes(class_teacher_id);
