import { pgTable, text, integer, boolean, jsonb, timestamp } from 'drizzle-orm/pg-core';

// 'users' table using Firebase Auth string UID as primary key
export const users = pgTable('users', {
  uid: text('uid').primaryKey(),
  email: text('email').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 'patients' table storing clinician-owned patient profiles
export const patients = pgTable('patients', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .references(() => users.uid, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  age: integer('age').notNull(),
  gender: text('gender').notNull(), // 'Male' | 'Female' | 'Other'
  mrn: text('mrn').notNull(),
  indication: text('indication').notNull(),
  createdAt: text('created_at').notNull(), // ISO String
});

// 'studies' table storing patient echocardiograms and reports
export const studies = pgTable('studies', {
  id: text('id').primaryKey(),
  patientId: text('patient_id')
    .references(() => patients.id, { onDelete: 'cascade' })
    .notNull(),
  userId: text('user_id')
    .references(() => users.uid, { onDelete: 'cascade' })
    .notNull(),
  studyDate: text('study_date').notNull(),
  imageUrl: text('image_url'), // base64 or storage url
  isSimulation: boolean('is_simulation').notNull(),
  simulationType: text('simulation_type'), // EchoViewType
  notes: text('notes'),
  analysisReport: jsonb('analysis_report'), // EchoAnalysisReport structure
});
