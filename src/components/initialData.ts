import { Patient, EchoStudy } from '../types';

export const INITIAL_PATIENTS: Patient[] = [
  {
    id: 'P001',
    name: 'Eleanor Vance',
    age: 68,
    gender: 'Female',
    mrn: 'MRN-984210',
    indication: 'Shortness of breath on exertion. Rule out diastolic dysfunction and valvular disease.',
    createdAt: '2026-06-15T10:42:00Z'
  },
  {
    id: 'P002',
    name: 'Marcus Brody',
    age: 54,
    gender: 'Male',
    mrn: 'MRN-773512',
    indication: 'Follow-up for chronic hypertension. Assess left ventricular hypertrophy and mass index.',
    createdAt: '2026-06-18T14:15:00Z'
  },
  {
    id: 'P003',
    name: 'Aria Sterling',
    age: 32,
    gender: 'Female',
    mrn: 'MRN-112984',
    indication: 'Atypical chest pain in highly trained marathon runner. Evaluate chambers and contractility.',
    createdAt: '2026-06-20T09:30:00Z'
  },
  {
    id: 'P004',
    name: 'Julian Vance',
    age: 76,
    gender: 'Male',
    mrn: 'MRN-442981',
    indication: 'Known severe Aortic Stenosis. Evaluated for upcoming TAVR (Transcatheter Aortic Valve Replacement).',
    createdAt: '2026-06-25T11:00:00Z'
  }
];

export const INITIAL_STUDIES: EchoStudy[] = [
  {
    id: 'S001',
    patientId: 'P001',
    studyDate: '2026-06-15',
    isSimulation: true,
    simulationType: 'A4C',
    notes: 'Mitral regurgitant jet noted. Chamber sizes appear dilated. Referred to cardiology consult.',
    analysisReport: {
      viewType: 'A4C',
      pathology: 'Mitral Regurgitation',
      confidence: 0.94,
      measurements: {
        ef: 42,
        lvid_d: 54,
        lvid_s: 38,
        ivs: 11,
        lvpw: 10,
        la_size: 44, // Dilated LA
        ao_root: 32
      },
      findings: [
        'Left Ventricular systolic function is moderately reduced (Estimated EF 42%).',
        'Severe dilatation of the Left Atrium (LA size 44mm) indicating chronic pressure/volume overload.',
        'Mitral valve leaflets show structural thickening with eccentric regurgitant jet visible during systole.',
        'Interventricular septum and posterior wall demonstrate normal thicknesses.'
      ],
      clinicalImpression: 'Moderately reduced LV systolic function with severe Left Atrial enlargement and moderate-to-severe Mitral Regurgitation.'
    }
  },
  {
    id: 'S002',
    patientId: 'P002',
    studyDate: '2026-06-18',
    isSimulation: true,
    simulationType: 'PSAX',
    notes: 'Concentric thickening of the myocardium. No regional wall motion abnormalities detected.',
    analysisReport: {
      viewType: 'PSAX',
      pathology: 'Concentric Left Ventricular Hypertrophy',
      confidence: 0.91,
      measurements: {
        ef: 62,
        lvid_d: 44,
        lvid_s: 26,
        ivs: 14, // Concentric hypertrophy (thick septum)
        lvpw: 13, // Thick posterior wall
        la_size: 36,
        ao_root: 35
      },
      findings: [
        'Preserved Left Ventricular Ejection Fraction (Estimated EF 62%) with hyperdynamic systolic function.',
        'Concentric thickening of the interventricular septum (14mm) and posterior wall (13mm) consistent with Concentric LV Hypertrophy.',
        'Small Left Ventricular internal dimensions in diastole, indicating restricted filling cavity.',
        'Normal valvular structures without hemodynamically significant stenosis or regurgitation.'
      ],
      clinicalImpression: 'Concentric Left Ventricular Hypertrophy (LVH) secondary to severe hypertension. Preserved ejection fraction with signs of diastolic filling impairment.'
    }
  },
  {
    id: 'S003',
    patientId: 'P003',
    studyDate: '2026-06-20',
    isSimulation: true,
    simulationType: 'PLAX',
    notes: 'Completely normal athletic heart. Mild physiological LV dilatation, highly compliant walls.',
    analysisReport: {
      viewType: 'PLAX',
      pathology: 'Normal',
      confidence: 0.98,
      measurements: {
        ef: 58,
        lvid_d: 48,
        lvid_s: 31,
        ivs: 9,
        lvpw: 9,
        la_size: 34,
        ao_root: 30
      },
      findings: [
        'Completely normal Left Ventricular cavity sizes and systolic function (EF 58%).',
        'Normal myocardial wall thicknesses (IVS 9mm, LVPW 9mm) with excellent symmetric contractility.',
        'Normal cardiac valve leaflet mobility and excursion; no stenosis or regurgitation identified.',
        'Normal Left Atrial and Aortic Root diameters.'
      ],
      clinicalImpression: 'Completely normal resting echocardiogram. Physiological athletic features with normal cavity volumes and preserved ejection fraction.'
    }
  },
  {
    id: 'S004',
    patientId: 'P004',
    studyDate: '2026-06-25',
    isSimulation: true,
    simulationType: 'PLAX',
    notes: 'Severe aortic valve calcification. High transvalvular gradient predicted.',
    analysisReport: {
      viewType: 'PLAX',
      pathology: 'Aortic Valve Stenosis',
      confidence: 0.89,
      measurements: {
        ef: 48,
        lvid_d: 52,
        lvid_s: 36,
        ivs: 13,
        lvpw: 12,
        la_size: 41,
        ao_root: 36
      },
      findings: [
        'LV systolic function is mildly reduced (EF 48%).',
        'Mild concentric left ventricular hypertrophy (IVS 13mm, LVPW 12mm) secondary to chronic outflow resistance.',
        'Severe aortic valve calcification with heavily restricted systolic leaflet separation.',
        'Mild mitral regurgitation secondary to left atrial enlargement.'
      ],
      clinicalImpression: 'Severe Aortic Valve Stenosis with chronic pressure-overload induced LV hypertrophy. Mildly reduced LV contractility. Patient referred for urgent TAVR workup.'
    }
  }
];
