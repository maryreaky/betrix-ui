/**
 * Statistical Models & Calculations
 */

/**
 * ELO rating system for teams
 */
class ELOModel {
  constructor(kFactor = 32) {
    this.kFactor = kFactor;
  }

  calculateExpectedScore(rating1, rating2) {
    return 1 / (1 + Math.pow(10, (rating2 - rating1) / 400));
  }

  updateRating(currentRating, score, expectedScore) {
    return Math.round(currentRating + this.kFactor * (score - expectedScore));
  }
}

/**
 * Form curve - recent performance weighting
 */
class FormAnalyzer {
  calculateFormScore(recentResults) {
    if (!recentResults || !recentResults.length) return 50;

    const weights = [3, 2.5, 2, 1.5, 1]; // More recent = higher weight
    let totalWeight = 0;
    let weightedScore = 0;

    recentResults.slice(0, 5).forEach((result, i) => {
      const weight = weights[i] || 1;
      const points = result === "W" ? 3 : result === "D" ? 1 : 0;
      weightedScore += points * weight;
      totalWeight += weight;
    });

    return Math.round((weightedScore / totalWeight / 3) * 100);
  }

  calculateMomentum(formScores) {
    if (!formScores || formScores.length < 2) return 0;
    return formScores[formScores.length - 1] - formScores[0];
  }
}

/**
 * Confidence scoring
 */
class ConfidenceCalculator {
  calculate(factors = {}) {
    let confidence = 0.5;

    if (factors.formDifference) {
      confidence += Math.abs(factors.formDifference) * 0.05;
    }

    if (factors.h2hAdvantage) {
      confidence += factors.h2hAdvantage * 0.03;
    }

    if (factors.marketOdds) {
      // Bet on implied probability
      confidence += Math.abs(factors.marketOdds - 0.5) * 0.02;
    }

    if (factors.injuryImpact) {
      confidence -= factors.injuryImpact * 0.1;
    }

    return Math.min(0.95, Math.max(0.5, confidence));
  }
}

export { ELOModel, FormAnalyzer, ConfidenceCalculator };
