/** Softnox leave quota (company policy). */
export const LEAVE_QUOTA = { casual: 6, annual: 8, sick: 6 };
export const LEAVE_QUOTA_TOTAL = LEAVE_QUOTA.casual + LEAVE_QUOTA.annual + LEAVE_QUOTA.sick; // 20

/**
 * JAN–AUG leave remaining sheet (total remaining days).
 * Special: probation | none | wfh
 */
export const LEAVE_REMAINING_BY_NAME = {
  "WAJIHA SHAIKH": 0,
  "MUHAMMAD UMER": 16,
  "AHMER AMIR": 12,
  "MOHSIN ABBAS": 13,
  "ABDUL REHMAN": 17, // IT — also Illustration Artist 15 later; match by designation when ambiguous
  "MUZAMIL JAWED": 0,
  "MUZAMIL JAVED": 0,
  "DANIYAL QASIM": 1,
  "AHMED NAWAZ": 4,
  "KAPEEL NENWANI": 12,
  "SHAHEER MUSTAFA": 0,
  "IMRAN MANZOOR": 0,
  "UMAIR FAROOQ": 9,
  "SHARIQ MAJEED KHAN": 3,
  "BRIEN JAVED": "probation",
  "SYED MOAAZ ALI": 6,
  "MAIR RIAZ MALIK": 3,
  "MUHAMMAD USAMA": 0,
  "SARDAR MUHAMMAD UMAIR KHAN": 5,
  "SYED BILAL UL HAQ": 8,
  "AMMAR SHAHZAD": "probation",
  "MUHAMMAD ARSALAN AZAM": 4,
  "FARRUKH AHMED KHAN": 5,
  "MUNSIF CHANDIO": 8,
  "JAVERIA NASIR": 0,
  "MUHAMMAD UZAIR": 13,
  "ALI TASLEEM": 0,
  "AUN RAZA": "none",
  "HANNAN MAQSOOD": 0,
  "AKASH MAHESHWARY": 0,
  "MUHAMMAD SHAHERYAR KHAN": 10,
  "INZA ALI": 0,
  "ZEEST ZIA SIDDIQUI": "probation",
  "MELVYN JASON ANTHONY DSILVA": "probation",
  "SHAHMEER AHMED KHAN": 8,
  "MUDASSIR AHMED": 11,
  "ALI REHAN": 15,
  "USAMA EJAZ MALIK": 3,
  "M. SHOAIB ASHFAQ": "none",
  "M SHOAIB ASHFAQ": "none",
  "TALHA KHURSHEED": 10,
  "HAFIZ HUZAIFA MEHMOOD": 15,
  "HAMZA HASHMI": 12,
  "OMAIR SIDDIQUI": 0,
  "TAUSEEF AHMED": 8,
  "OZAIR SIDDIQUI": 11,
  "TABRAIZ TAHIR": 15,
  "SARFARAZ": 5,
  "SHAWN JOHN": 18,
  "SEPHORA VAZ": 12,
  "ZARYAB KHAN JADOON": 0,
  "SIDRA KHAN": 5,
  "ASFANDYAR QURESHI": 19,
  "ASRA HASSAN": 0,
  "FAISAL": "probation",
  "ZOYA FAISAL": 2,
  "ADNAN MEHMOOD": 13,
  "TAYMOOR FAZAL": "probation",
  "TAYMOOR TAHIR": 18,
  "HUSSAIN MOHSEN": 16,
  "ANAMTA ZULFIQAR": 0,
  "SHAZMEEN SHAFIQ": 17,
  "AREEJ AKMAL": 8,
  "AYESHA LARAIB": 7,
  "MARYAM NOMAN": 1,
  "AMNA RAFIQ": 3,
  "DANIA HANIF KHAN": "probation",
  "ERUM TARIQ": "probation",
  "ARISHA KHAN": 0,
  "SYEDA RUMESHA FATIMA": 8,
  "SYEDA ABEEHA BATOOL": "probation",
  "AMNA SHAHID": 12,
  "ILMA FATIMA": 5,
  "HAMNA AMIR ALI": "probation",
  "AYESHA SAEED": 4,
  "FATIMA AZFAR": 6,
  "NIDA YOUSUF": 15,
  "ANOOSH FATIMA": "probation",
  "SYED SHUJAT HUSSAIN": "probation",
  "BUSHRA HATMI": 8,
  "TOOBA SALEEM": "probation",
  "NARMEEN AKHTAR": "probation",
  "HADIQA YOUSUF KHAN": "probation",
  "ROSHAN-E-ALI KHAN": "probation",
  "ROSHAN E ALI KHAN": "probation",
  "ARISH MAHMOOD": "probation",
  "MUHAMMAD ARQUM": 13,
  "UZAIR AYUB": 9,
  "MALAIKA BABAR": 7,
  "SALKA OMAN": "probation",
  "UNSA FAHEEM": 8,
  "MUHAMMAD ABDULLAH MASHWANI": 19,
  "AMEED IQBAL": 14,
  "OMAMA": 15,
  "TAHA AHMED": 12,
  "USMAN AHMED SHEIKH": 10,
  "MUHAMMAD FURQAN BIN RIZWAN": "wfh",
  "REMAISA JAWED": 2,
  "ABU SAEED SUFIYAN": 9,
  "QADIR SALMAN": 8,
  "WAQAR AHMED": 0,
  "MUHAMMAD DANIYAL": 0,
  "QAZI SHUJA": 17,
  "EMAN RAZA": 4,
  "HAIDER ALI": 7,
};

/** Extra rows that collide on name — prefer designation keywords. */
export const LEAVE_REMAINING_BY_NAME_DESIGNATION = [
  { name: "ABDUL REHMAN", designationIncludes: ["ILLUSTRATION"], remaining: 15 },
  { name: "ABDUL REHMAN", designationIncludes: ["IT", "JUNIOR", "ADMIN"], remaining: 17 },
];

export function normalizePersonName(name = "") {
  return String(name)
    .toUpperCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[^A-Z0-9\s.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Common Softnox spelling variants → sheet key */
const NAME_ALIASES = {
  "MUZZAMIL JAVEED": "MUZAMIL JAWED",
  "MUZZAMIL JAVED": "MUZAMIL JAWED",
  "MUZAMIL JAVEED": "MUZAMIL JAWED",
  "MUZZAMIL JAWED": "MUZAMIL JAWED",
  "M SHOAIB ASHFAQ": "M. SHOAIB ASHFAQ",
  "SHOAIB ASHFAQ": "M. SHOAIB ASHFAQ",
  "ILMA FATIMA NEW": "ILMA FATIMA",
  "ROSHANEALI KHAN": "ROSHAN-E-ALI KHAN",
  "ROSHAN E ALI KHAN": "ROSHAN-E-ALI KHAN",
  "FURQAN BIN RIZWAN": "MUHAMMAD FURQAN BIN RIZWAN",
  "MUHAMMAD FURQAN BIN RIZWAN REMOTE": "MUHAMMAD FURQAN BIN RIZWAN",
};

export function canonicalSheetName(name = "") {
  const norm = normalizePersonName(name);
  if (NAME_ALIASES[norm]) return NAME_ALIASES[norm];
  return norm;
}

/**
 * Split total remaining days across casual → annual → sick (use order).
 * Quota: 6 casual, 8 annual, 6 sick.
 */
export function splitRemaining(remainingRaw) {
  if (remainingRaw === "probation" || remainingRaw === "none") {
    return { casual: 0, annual: 0, sick: 0, note: remainingRaw };
  }
  if (remainingRaw === "wfh") {
    return { ...LEAVE_QUOTA, note: "wfh" };
  }

  const remaining = Math.max(0, Math.min(LEAVE_QUOTA_TOTAL, Number(remainingRaw) || 0));
  let used = LEAVE_QUOTA_TOTAL - remaining;
  let casual = LEAVE_QUOTA.casual;
  let annual = LEAVE_QUOTA.annual;
  let sick = LEAVE_QUOTA.sick;

  const burn = (avail) => {
    const take = Math.min(avail, used);
    used -= take;
    return avail - take;
  };

  casual = burn(casual);
  annual = burn(annual);
  sick = burn(sick);

  return { casual, annual, sick, note: "allotted" };
}

export function lookupRemaining(employeeName, jobTitle = "") {
  const norm = canonicalSheetName(employeeName);
  const title = normalizePersonName(jobTitle);

  for (const row of LEAVE_REMAINING_BY_NAME_DESIGNATION) {
    if (canonicalSheetName(row.name) === norm) {
      if (row.designationIncludes.some((k) => title.includes(k))) {
        return row.remaining;
      }
    }
  }

  if (Object.prototype.hasOwnProperty.call(LEAVE_REMAINING_BY_NAME, norm)) {
    return LEAVE_REMAINING_BY_NAME[norm];
  }

  // Fuzzy: sheet key contained in DB name or vice versa
  for (const [key, val] of Object.entries(LEAVE_REMAINING_BY_NAME)) {
    const k = canonicalSheetName(key);
    if (norm === k) return val;
    if (norm.length >= 6 && k.length >= 6 && (norm.includes(k) || k.includes(norm))) return val;
  }

  return null;
}
