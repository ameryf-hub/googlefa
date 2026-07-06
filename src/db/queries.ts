import { eq, and } from 'drizzle-orm';
import { db } from './index.ts';
import { patients, studies } from './schema.ts';
import { INITIAL_PATIENTS, INITIAL_STUDIES } from '../components/initialData.ts';

// Get all patients for a user, seed with defaults if none exist
export async function getUserPatients(userId: string) {
  try {
    const userPatients = await db.select()
      .from(patients)
      .where(eq(patients.userId, userId));

    if (userPatients.length === 0) {
      // Seed default patients for this new user
      console.log(`Seeding default patients for user: ${userId}`);
      const seedPatients = INITIAL_PATIENTS.map(p => ({
        ...p,
        userId,
      }));

      const seeded = await db.insert(patients)
        .values(seedPatients)
        .returning();
      
      return seeded;
    }

    return userPatients;
  } catch (error) {
    console.error("Error getting patients:", error);
    throw new Error("Failed to load patient records. Please try again later.", { cause: error });
  }
}

// Add a new patient for a user
export async function addUserPatient(patientData: {
  id: string;
  name: string;
  age: number;
  gender: string;
  mrn: string;
  indication: string;
  createdAt: string;
}, userId: string) {
  try {
    const result = await db.insert(patients)
      .values({
        ...patientData,
        userId,
      })
      .returning();
    return result[0];
  } catch (error) {
    console.error("Error adding patient:", error);
    throw new Error("Failed to save patient record.", { cause: error });
  }
}

// Get all studies for a user, seed with defaults if none exist
export async function getUserStudies(userId: string) {
  try {
    const userStudies = await db.select()
      .from(studies)
      .where(eq(studies.userId, userId));

    if (userStudies.length === 0) {
      // Seed default studies for this user
      console.log(`Seeding default studies for user: ${userId}`);
      
      // Make sure the referenced patients actually exist (we seed patients first usually)
      // To prevent foreign key constraint issues, check if the corresponding patient exists
      const seedStudiesList = [];
      for (const study of INITIAL_STUDIES) {
        // Ensure patient exists in DB for this user
        const existingPatient = await db.select()
          .from(patients)
          .where(and(eq(patients.id, study.patientId), eq(patients.userId, userId)));
        
        if (existingPatient.length > 0) {
          seedStudiesList.push({
            id: study.id,
            patientId: study.patientId,
            userId,
            studyDate: study.studyDate,
            imageUrl: study.imageUrl || null,
            isSimulation: study.isSimulation,
            simulationType: study.simulationType || null,
            notes: study.notes || null,
            analysisReport: study.analysisReport || null,
          });
        }
      }

      if (seedStudiesList.length > 0) {
        const seeded = await db.insert(studies)
          .values(seedStudiesList)
          .returning();
        return seeded;
      }
    }

    return userStudies;
  } catch (error) {
    console.error("Error getting studies:", error);
    throw new Error("Failed to load studies. Please try again later.", { cause: error });
  }
}

// Save or update an echocardiogram study
export async function saveUserStudy(studyData: {
  id: string;
  patientId: string;
  studyDate: string;
  imageUrl?: string | null;
  isSimulation: boolean;
  simulationType?: string | null;
  notes?: string | null;
  analysisReport?: any;
}, userId: string) {
  try {
    const result = await db.insert(studies)
      .values({
        id: studyData.id,
        patientId: studyData.patientId,
        userId,
        studyDate: studyData.studyDate,
        imageUrl: studyData.imageUrl || null,
        isSimulation: studyData.isSimulation,
        simulationType: studyData.simulationType || null,
        notes: studyData.notes || null,
        analysisReport: studyData.analysisReport || null,
      })
      .onConflictDoUpdate({
        target: studies.id,
        set: {
          studyDate: studyData.studyDate,
          imageUrl: studyData.imageUrl || null,
          isSimulation: studyData.isSimulation,
          simulationType: studyData.simulationType || null,
          notes: studyData.notes || null,
          analysisReport: studyData.analysisReport || null,
        }
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error("Error saving study:", error);
    throw new Error("Failed to persist study details.", { cause: error });
  }
}
