export interface Patient {
  id: string;
  name: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  mrn: string; // Medical Record Number
  indication: string; // Reason for study
  createdAt: string;
}

export interface EchoMeasurement {
  ef: number; // Ejection Fraction (%)
  lvid_d?: number; // Left Ventricular Internal Diameter in Diastole (mm)
  lvid_s?: number; // Left Ventricular Internal Diameter in Systole (mm)
  ivs?: number; // Interventricular Septum thickness (mm)
  lvpw?: number; // LV Posterior Wall thickness (mm)
  la_size?: number; // Left Atrium Size (mm)
  ao_root?: number; // Aortic Root diameter (mm)
}

export type EchoViewType = 
  | 'PLAX' // Parasternal Long Axis
  | 'PSAX' // Parasternal Short Axis
  | 'A4C'  // Apical 4-Chamber
  | 'A2C'  // Apical 2-Chamber
  | 'A3C'  // Apical 3-Chamber
  | 'Subcostal'
  | 'Unknown';

export type CardiacPathology =
  | 'Normal'
  | 'Dilated Cardiomyopathy'
  | 'Concentric Left Ventricular Hypertrophy'
  | 'Regional Wall Motion Abnormality'
  | 'Aortic Valve Stenosis'
  | 'Mitral Regurgitation'
  | 'Pericardial Effusion';

export interface EchoAnalysisReport {
  viewType: EchoViewType;
  pathology: CardiacPathology;
  confidence: number;
  measurements: EchoMeasurement;
  findings: string[];
  clinicalImpression: string;
}

export interface EchoStudy {
  id: string;
  patientId: string;
  studyDate: string;
  imageUrl?: string; // base64 or URL for the frame/image
  isSimulation: boolean;
  simulationType?: EchoViewType;
  notes?: string;
  analysisReport?: EchoAnalysisReport;
}
