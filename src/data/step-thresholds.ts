/**
 * A copy of the app's data/step-thresholds.json (METTracker), as a module so
 * Node's test runner and the Astro build read it alike. If the app's file
 * changes, regenerate this one from it — the same discipline science.ts keeps
 * for its copies. Do not edit by hand.
 */
export default {
  "version": "1.0",
  "sources": {
    "tiers": "Paluch et al, JACC 2023 (n=111,309 participants, 7.1-year follow-up) · Banach et al, Lancet 2025 meta-analysis",
    "cvdPlateau": "Paluch et al, JACC 2023 — CVD mortality benefit plateaus around 7,200 steps/day",
    "optimalSteps": "Banach et al, Lancet 2025 meta-analysis — all-cause mortality optimal ~8,800 steps/day",
    "cadence": "Strain et al, JAMA Internal Medicine 2022 — peak 30-min cadence independently predicts all-cause and CVD mortality, independent of total step volume"
  },
  "tiers": [
    {
      "key": "sedentary",
      "label": "Sedentary",
      "sublabel": "Below minimum effective dose",
      "min": 0,
      "max": 2599,
      "color": "#ef4444",
      "bg": "#fee2e2",
      "description": "Below the minimum step count associated with any mortality benefit vs a completely sedentary lifestyle."
    },
    {
      "key": "light",
      "label": "Active",
      "sublabel": "Minimum effective dose",
      "min": 2600,
      "max": 6999,
      "color": "#f97316",
      "bg": "#ffedd5",
      "description": "Meets the minimum threshold for step-related mortality benefit. Each additional 1,000 steps reduces all-cause mortality risk."
    },
    {
      "key": "moderate",
      "label": "Cardiovascular",
      "sublabel": "CVD benefit peak",
      "min": 7000,
      "max": 8799,
      "color": "#22c55e",
      "bg": "#dcfce7",
      "description": "In the range where cardiovascular disease mortality benefit peaks (~7,200 steps/day). All-cause mortality continues to improve beyond this level."
    },
    {
      "key": "optimal",
      "label": "Optimal",
      "sublabel": "Mortality-optimal zone",
      "min": 8800,
      "max": 999999,
      "color": "#10b981",
      "bg": "#d1fae5",
      "description": "The mortality-optimal step range identified by meta-analysis. No additional mortality benefit has been seen beyond ~12,000 steps/day."
    }
  ],
  "cadenceTiers": [
    {
      "key": "incidental",
      "label": "Incidental",
      "sublabel": "Slow / casual movement",
      "min": 0,
      "max": 79,
      "color": "#94a3b8"
    },
    {
      "key": "purposeful",
      "label": "Purposeful",
      "sublabel": "Moderate walking pace",
      "min": 80,
      "max": 99,
      "color": "#f59e0b"
    },
    {
      "key": "brisk",
      "label": "Brisk",
      "sublabel": "Aerobic benefit",
      "min": 100,
      "max": 129,
      "color": "#3b82f6"
    },
    {
      "key": "vigorous",
      "label": "Vigorous",
      "sublabel": "High-intensity",
      "min": 130,
      "max": 9999,
      "color": "#8b5cf6"
    }
  ],
  "doseResponse": [
    {
      "steps": 2000,
      "allCausePct": 0,
      "cvdPct": 0
    },
    {
      "steps": 2600,
      "allCausePct": 8,
      "cvdPct": 5
    },
    {
      "steps": 4000,
      "allCausePct": 23,
      "cvdPct": 15
    },
    {
      "steps": 6000,
      "allCausePct": 44,
      "cvdPct": 40
    },
    {
      "steps": 7000,
      "allCausePct": 52,
      "cvdPct": 50
    },
    {
      "steps": 7200,
      "allCausePct": 54,
      "cvdPct": 55
    },
    {
      "steps": 8000,
      "allCausePct": 58,
      "cvdPct": 55
    },
    {
      "steps": 8800,
      "allCausePct": 63,
      "cvdPct": 55
    },
    {
      "steps": 10000,
      "allCausePct": 67,
      "cvdPct": 55
    },
    {
      "steps": 12000,
      "allCausePct": 70,
      "cvdPct": 55
    }
  ],
  "referenceLines": {
    "minimumDose": 2600,
    "cvdPeak": 7000,
    "mortalityOptimal": 8800,
    "chartCeiling": 12000
  }
} as const;
