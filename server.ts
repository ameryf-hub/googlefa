import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { requireAuth, AuthRequest } from "./src/middleware/auth.ts";
import { getOrCreateUser } from "./src/db/users.ts";
import { getUserPatients, addUserPatient, getUserStudies, saveUserStudy } from "./src/db/queries.ts";

dotenv.config();

const PORT = 3000;

// Initialize GoogleGenAI SDK with lazy checks
let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is missing. Please configure it in Settings > Secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Define local ThinkingLevel enum as specified in agent rules
enum ThinkingLevel {
  OFF = "OFF",
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
}

async function startServer() {
  const app = express();

  // Set high body limits to allow large image uploads (Echo frames or cine loops)
  app.use(express.json({ limit: "35mb" }));
  app.use(express.urlencoded({ limit: "35mb", extended: true }));

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // User synchronization (authenticated)
  app.post("/api/sync-user", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { uid, email } = req.user!;
      const user = await getOrCreateUser(uid, email || "");
      res.json({ success: true, user });
    } catch (err: any) {
      console.error("Error in /api/sync-user:", err);
      res.status(500).json({ error: err.message || "Failed to sync user" });
    }
  });

  // Get user patients (authenticated, auto-seeds default patients if empty)
  app.get("/api/patients", requireAuth, async (req: AuthRequest, res) => {
    try {
      const patientsList = await getUserPatients(req.user!.uid);
      res.json({ success: true, patients: patientsList });
    } catch (err: any) {
      console.error("Error in GET /api/patients:", err);
      res.status(500).json({ error: err.message || "Failed to retrieve patients" });
    }
  });

  // Create a new patient (authenticated)
  app.post("/api/patients", requireAuth, async (req: AuthRequest, res) => {
    try {
      const patient = await addUserPatient(req.body, req.user!.uid);
      res.json({ success: true, patient });
    } catch (err: any) {
      console.error("Error in POST /api/patients:", err);
      res.status(500).json({ error: err.message || "Failed to save patient" });
    }
  });

  // Get user studies (authenticated, auto-seeds default studies if empty)
  app.get("/api/studies", requireAuth, async (req: AuthRequest, res) => {
    try {
      const studiesList = await getUserStudies(req.user!.uid);
      res.json({ success: true, studies: studiesList });
    } catch (err: any) {
      console.error("Error in GET /api/studies:", err);
      res.status(500).json({ error: err.message || "Failed to retrieve studies" });
    }
  });

  // Save or update an echocardiogram study (authenticated)
  app.post("/api/studies", requireAuth, async (req: AuthRequest, res) => {
    try {
      const study = await saveUserStudy(req.body, req.user!.uid);
      res.json({ success: true, study });
    } catch (err: any) {
      console.error("Error in POST /api/studies:", err);
      res.status(500).json({ error: err.message || "Failed to save study" });
    }
  });

  // Echo Cine Loop & Frame Analysis Endpoint
  app.post("/api/analyze-echo", async (req, res) => {
    try {
      const { 
        viewType, 
        measurements, 
        patientIndication, 
        patientAge, 
        patientGender, 
        image, 
        mimeType,
        useThinkingMode 
      } = req.body;

      const client = getAiClient();
      
      // Select the model based on requested depth
      // Metadata rule: "Use gemini-3.1-pro-preview for complex tasks, gemini-3.5-flash for general tasks"
      // Metadata rule: "set thinkingLevel to ThinkingLevel.HIGH. Do not set maxOutputTokens" for complex queries.
      const selectedModel = useThinkingMode ? "gemini-3.1-pro-preview" : "gemini-3.5-flash";

      let promptText = `You are an expert Cardiologist and Echocardiography Clinical AI Assistant.
Analyze the following Echocardiogram study parameters and provide a comprehensive, structured clinical report.

PATIENT METADATA:
- Age: ${patientAge || "Unknown"}
- Gender: ${patientGender || "Unknown"}
- Clinical Indication: ${patientIndication || "Routine screen / General cardiological evaluation"}

CURRENT STUDY CONTEXT:
- Echocardiographic View: ${viewType || "Apical 4-Chamber (A4C)"}
- Caliper Measurements (taken by sonographer): ${measurements ? JSON.stringify(measurements) : "No calipers placed yet."}

Your diagnostic objective:
1. Synthesize the provided caliper measurements, clinical indication, and (if present) image features.
2. Determine the primary Echocardiographic view type (PLAX, PSAX, A4C, A2C, or Subcostal).
3. Classify the overall Cardiac Pathology: 'Normal', 'Dilated Cardiomyopathy', 'Concentric Left Ventricular Hypertrophy', 'Regional Wall Motion Abnormality', 'Aortic Valve Stenosis', 'Mitral Regurgitation', or 'Pericardial Effusion'.
4. Provide standard normal reference values and estimate missing cardiac measurements if appropriate.
5. Create a bulleted list of 3-4 professional clinical findings.
6. Formulate a 1-2 sentence clinical impression.

You MUST respond strictly in a valid JSON object format with the following exact keys:
{
  "viewType": "${viewType || "A4C"}",
  "pathology": "Normal | Dilated Cardiomyopathy | Concentric Left Ventricular Hypertrophy | Regional Wall Motion Abnormality | Aortic Valve Stenosis | Mitral Regurgitation | Pericardial Effusion",
  "confidence": 0.85,
  "measurements": {
    "ef": 55,
    "lvid_d": 45,
    "lvid_s": 30,
    "ivs": 10,
    "lvpw": 10,
    "la_size": 36,
    "ao_root": 34
  },
  "findings": [
    "Normal Left Ventricular chamber dimensions and systolic function.",
    "Normal thickening of interventricular septum and posterior wall.",
    "Mitral and aortic valve leaflets demonstrate normal excursion without visible stenosis or regurgitation.",
    "No pericardial effusion identified."
  ],
  "clinicalImpression": "Normal resting echocardiogram. Preserved LV systolic function with normal valvular structures."
}

Ensure all measurements are clinical, sensible, and aligned with American Society of Echocardiography (ASE) standards.
For instance:
- Concentric LV Hypertrophy is diagnosed when Interventricular Septum (IVS) or LV Posterior Wall (LVPW) is >= 12mm.
- Dilated Cardiomyopathy typically presents with increased LVIDd (e.g. > 56mm) and reduced Ejection Fraction (EF < 45%).
- Regional Wall Motion Abnormality should show normal wall thickness but reduced EF.
- Pericardial effusion is identified by fluid separation in the posterior pericardial space.

Do not output any markdown formatting, wrappers, or text outside the JSON object. Just the clean JSON.`;

      const contentsParts: any[] = [];

      // If an image (Echo frame) is supplied, add it to content
      if (image) {
        let cleanBase64 = image;
        let detectedMime = mimeType || "image/jpeg";
        if (image.startsWith("data:")) {
          const matches = image.match(/^data:([^;]+);base64,(.*)$/);
          if (matches && matches.length === 3) {
            detectedMime = matches[1];
            cleanBase64 = matches[2];
          }
        }
        contentsParts.push({
          inlineData: {
            data: cleanBase64,
            mimeType: detectedMime
          }
        });
      }

      contentsParts.push({ text: promptText });

      console.log(`Analyzing Echo: model=${selectedModel}, thinkingMode=${useThinkingMode ? "HIGH" : "OFF"}`);

      // Build model configuration
      const config: any = {
        responseMimeType: "application/json",
      };

      if (useThinkingMode) {
        // "You MUST use the gemini-3.1-pro-preview model and set thinkingLevel to ThinkingLevel.HIGH. Do not set maxOutputTokens."
        config.thinkingConfig = {
          thinkingBudget: 4096, // set typical high token thinking budget
          thinkingLevel: ThinkingLevel.HIGH,
        };
      }

      const response = await client.models.generateContent({
        model: selectedModel,
        contents: contentsParts,
        config: config,
      });

      const textResponse = response.text;
      if (!textResponse) {
        return res.status(502).json({ error: "Model returned an empty report." });
      }

      try {
        const parsedReport = JSON.parse(textResponse.trim());
        return res.json({ success: true, report: parsedReport });
      } catch (parseErr) {
        console.error("Failed to parse echo report as JSON:", textResponse);
        return res.status(502).json({
          error: "Model output was not in valid clinical JSON format.",
          rawText: textResponse,
        });
      }
    } catch (err: any) {
      console.error("Error analyzing Echocardiogram:", err);
      return res.status(500).json({
        error: err.message || "Internal server error analyzing Echocardiogram",
      });
    }
  });

  // Clinical Guidelines & Reference search (Search Grounding)
  app.post("/api/clinical-search", async (req, res) => {
    try {
      const { query } = req.body;
      if (!query) {
        return res.status(400).json({ error: "No search query provided" });
      }

      console.log(`Executing clinical search: ${query}`);
      const client = getAiClient();

      // Rule: "You MUST add Search Grounding to the app where relevant to get up to date and accurate information. Use gemini-3.5-flash (with googleSearch tool)"
      const response = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `You are an expert cardiovascular imaging guidelines reference assistant. 
The user is asking a clinical question regarding echocardiographic guidelines or diagnostic criteria: "${query}".

Conduct a Google Search to retrieve the latest and most accurate standards from leading societies like the American Society of Echocardiography (ASE), American College of Cardiology (ACC), or European Society of Cardiology (ESC).
Synthesize the search results into a concise, professional clinical reference note. State normal values, grading scales (e.g. mild/moderate/severe), and cite specific guidelines with years if possible.`,
        config: {
          tools: [{ googleSearch: {} }]
        }
      });

      return res.json({
        success: true,
        answer: response.text || "No results found."
      });
    } catch (err: any) {
      console.error("Error conducting clinical search:", err);
      return res.status(500).json({
        error: err.message || "Failed to conduct clinical search",
      });
    }
  });

  // Center & Referral Finder (Maps Grounding)
  app.post("/api/center-finder", async (req, res) => {
    try {
      const { locationQuery } = req.body;
      if (!locationQuery) {
        return res.status(400).json({ error: "No referral location provided" });
      }

      console.log(`Executing cardiovascular center referral search near: ${locationQuery}`);
      const client = getAiClient();

      // Rule: "You MUST add Maps Grounding to the app where relevant to get up to date and accurate information. Use gemini-3.5-flash (with googleMaps tool)"
      // We will supply googleMaps as a tool (or googleSearch which integrates maps grounding seamlessly as fallback)
      const response = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `You are a clinical care coordinator helping a cardiologist or sonographer refer a patient for specialized echocardiography or cardiovascular imaging.
The clinician is looking for accredited echocardiography laboratories, hospital cardiac clinics, or specialized cardiovascular imaging centers near: "${locationQuery}".

Use Google Maps to find 3 or 4 high-quality facilities. Provide a structured, professional referral recommendation for each facility:
- Facility Name
- Address / Location
- Key Specialties (e.g., 'IAC Accredited Echocardiography', '3D Echo & Strain Imaging', 'Pediatric Cardiology')
- Clinical Referral Rationale (why they are suitable for complex consultations)`,
        config: {
          tools: [
            { googleSearch: {} }, // Include search as a rich grounding helper
            { googleMaps: {} } as any // Include explicit googleMaps tool as requested
          ]
        }
      });

      return res.json({
        success: true,
        referrals: response.text || "No local facilities found."
      });
    } catch (err: any) {
      console.error("Error searching referral centers:", err);
      return res.status(500).json({
        error: err.message || "Failed to locate cardiovascular clinics",
      });
    }
  });

  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start fullstack server:", err);
});
