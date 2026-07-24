export interface DepartmentOption {
  id: string;
  name: string;
}

export interface Recommendation {
  departmentId: string;
  departmentName: string;
  confidence: number;
}

const DEFAULT_KEYWORD_MAP: Record<string, string[]> = {
  cardiology: ["chest pain", "cardiac", "heart", "angina", "palpitations", "hypertension", "arrhythmia", "infarction", "ecg", "troponin", "bp high"],
  neurology: ["stroke", "seizure", "numbness", "paralysis", "migraine", "headache", "epilepsy", "loss of consciousness", "tremor", "vertigo", "gait"],
  "emergency medicine": ["trauma", "unconscious", "shock", "acute", "bleeding", "severe", "cardiac arrest", "emergency", "respiratory distress", "anaphylaxis"],
  "orthopedics": ["fracture", "bone", "joint", "dislocation", "knee", "spine", "ligament", "hip", "swelling", "ortho"],
  "internal medicine": ["fever", "fatigue", "diabetes", "sepsis", "infection", "jaundice", "anemia", "chills", "weight loss"],
  "gastroenterology": ["abdominal pain", "nausea", "vomiting", "diarrhea", "ulcer", "gastric", "liver", "constipation", "bloody stool"],
  "pulmonology": ["breathlessness", "shortness of breath", "cough", "asthma", "pneumonia", "copd", "spo2 low", "wheezing", "chest tightness"],
  "pediatrics": ["child", "infant", "pediatric", "neonate", "baby", "toddler"],
  "dermatology": ["rash", "lesion", "eczema", "skin", "psoriasis", "itching", "burn"],
  "nephrology": ["kidney", "renal", "dialysis", "urinary", "creatinine", "edema"],
};

export function getDepartmentRecommendations(
  textInput: string,
  departments: DepartmentOption[],
  customRules?: Record<string, string[]>
): Recommendation[] {
  if (!textInput || textInput.trim().length < 3 || departments.length === 0) {
    return [];
  }

  const normalized = textInput.toLowerCase();
  const ruleMap = customRules && Object.keys(customRules).length > 0 ? customRules : DEFAULT_KEYWORD_MAP;
  const scores: { dept: DepartmentOption; score: number }[] = [];

  for (const dept of departments) {
    const deptNameLower = dept.name.toLowerCase();
    let score = 0;

    // Check direct match in department name
    if (normalized.includes(deptNameLower)) {
      score += 60;
    }

    // Check keyword map matches
    for (const [keyCategory, keywords] of Object.entries(ruleMap)) {
      if (deptNameLower.includes(keyCategory.toLowerCase()) || keyCategory.toLowerCase().includes(deptNameLower)) {
        for (const kw of keywords) {
          if (normalized.includes(kw.toLowerCase())) {
            score += 25;
          }
        }
      }
    }

    if (score > 0) {
      scores.push({ dept, score: Math.min(score, 98) });
    }
  }

  scores.sort((a, b) => b.score - a.score);

  return scores.slice(0, 3).map((item) => ({
    departmentId: item.dept.id,
    departmentName: item.dept.name,
    confidence: item.score,
  }));
}
