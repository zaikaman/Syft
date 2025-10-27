/**
 * Strategy Analyzer Service (T113)
 * Identifies improvement opportunities in vault strategies
 * Analyzes configuration and performance to suggest optimizations
 */

import { VaultConfig, RebalanceRule } from '../../../shared/types/vault';

export interface StrategyIssue {
  severity: 'low' | 'medium' | 'high';
  category: 'risk' | 'performance' | 'efficiency' | 'diversification';
  title: string;
  description: string;
  impact: string;
  recommendation: string;
}

export interface StrategyAnalysis {
  vaultId: string;
  overallScore: number; // 0-100
  issues: StrategyIssue[];
  strengths: string[];
  improvementAreas: string[];
  riskLevel: 'low' | 'medium' | 'high';
  diversificationScore: number; // 0-100
  efficiencyScore: number; // 0-100
  timestamp: string;
}

export class StrategyAnalyzer {
  /**
   * Analyze a vault strategy configuration
   */
  async analyzeStrategy(
    vaultId: string,
    config: VaultConfig,
    _performanceData?: any
  ): Promise<StrategyAnalysis> {
    const issues: StrategyIssue[] = [];
    const strengths: string[] = [];
    const improvementAreas: string[] = [];

    // Analyze asset allocation
    const allocationIssues = this.analyzeAllocation(config);
    issues.push(...allocationIssues.issues);
    strengths.push(...allocationIssues.strengths);

    // Analyze rebalancing rules
    const ruleIssues = this.analyzeRebalancingRules(config.rules || []);
    issues.push(...ruleIssues.issues);
    strengths.push(...ruleIssues.strengths);

    // Analyze risk exposure
    const riskAnalysis = this.analyzeRisk(config);
    issues.push(...riskAnalysis.issues);
    strengths.push(...riskAnalysis.strengths);

    // Analyze diversification
    const diversificationScore = this.calculateDiversificationScore(config);
    if (diversificationScore < 50) {
      improvementAreas.push('Asset diversification could be improved');
    } else {
      strengths.push('Good asset diversification');
    }

    // Analyze efficiency
    const efficiencyScore = this.calculateEfficiencyScore(config);
    if (efficiencyScore < 60) {
      improvementAreas.push('Rebalancing frequency could be optimized');
    }

    // Calculate overall score
    const overallScore = this.calculateOverallScore(
      issues,
      diversificationScore,
      efficiencyScore
    );

    // Determine risk level
    const riskLevel = this.determineRiskLevel(issues, config);

    return {
      vaultId,
      overallScore,
      issues,
      strengths,
      improvementAreas,
      riskLevel,
      diversificationScore,
      efficiencyScore,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Analyze asset allocation
   */
  private analyzeAllocation(config: VaultConfig): {
    issues: StrategyIssue[];
    strengths: string[];
  } {
    const issues: StrategyIssue[] = [];
    const strengths: string[] = [];

    const assets = config.assets || [];
    const totalAllocation = assets.reduce((sum, asset) => sum + (asset.percentage || 0), 0);

    // Check if allocations sum to 100%
    if (Math.abs(totalAllocation - 100) > 0.1) {
      issues.push({
        severity: 'high',
        category: 'efficiency',
        title: 'Incorrect Asset Allocation',
        description: `Total allocation is ${totalAllocation}%, should be 100%`,
        impact: 'Vault may not deploy capital efficiently',
        recommendation: 'Adjust asset allocations to sum to exactly 100%',
      });
    }

    // Check for over-concentration in single asset
    const maxAllocation = Math.max(...assets.map(a => a.percentage || 0));
    if (maxAllocation > 70) {
      issues.push({
        severity: 'medium',
        category: 'risk',
        title: 'High Concentration Risk',
        description: `${maxAllocation}% allocated to a single asset`,
        impact: 'High exposure to single asset price movements',
        recommendation: 'Consider diversifying across more assets to reduce risk',
      });
    } else if (maxAllocation < 50 && assets.length >= 3) {
      strengths.push('Well-balanced asset allocation');
    }

    // Check for minimum viable allocation
    assets.forEach((asset, index) => {
      if (asset.percentage && asset.percentage < 5 && asset.percentage > 0) {
        issues.push({
          severity: 'low',
          category: 'efficiency',
          title: 'Very Small Allocation',
          description: `Asset ${index + 1} has only ${asset.percentage}% allocation`,
          impact: 'Transaction fees may outweigh returns on such small positions',
          recommendation: 'Consider allocating at least 5% to make position worthwhile',
        });
      }
    });

    // Check asset count
    if (assets.length < 2) {
      issues.push({
        severity: 'medium',
        category: 'diversification',
        title: 'Limited Diversification',
        description: 'Vault contains only one asset',
        impact: 'No diversification benefit; high correlation with single asset',
        recommendation: 'Add 2-4 additional assets for better risk distribution',
      });
    } else if (assets.length >= 3) {
      strengths.push('Good number of assets for diversification');
    }

    return { issues, strengths };
  }

  /**
   * Analyze rebalancing rules
   */
  private analyzeRebalancingRules(rules: RebalanceRule[]): {
    issues: StrategyIssue[];
    strengths: string[];
  } {
    const issues: StrategyIssue[] = [];
    const strengths: string[] = [];

    if (rules.length === 0) {
      issues.push({
        severity: 'high',
        category: 'efficiency',
        title: 'No Rebalancing Rules',
        description: 'Vault has no automated rebalancing rules configured',
        impact: 'Manual intervention required; vault won\'t adapt to market changes',
        recommendation: 'Add at least one rebalancing rule based on allocation drift or time',
      });
      return { issues, strengths };
    }

    if (rules.length >= 2) {
      strengths.push('Multiple rebalancing rules for flexible management');
    }

    // Check for time-based rules
    const hasTimeRule = rules.some(r => 
      r.conditions?.some(c => c.type === 'time')
    );
    if (!hasTimeRule) {
      issues.push({
        severity: 'low',
        category: 'efficiency',
        title: 'No Time-Based Rebalancing',
        description: 'No periodic rebalancing rule configured',
        impact: 'Vault may not rebalance regularly without market triggers',
        recommendation: 'Add a time-based rule to ensure periodic rebalancing',
      });
    }

    // Check for threshold-based rules
    const hasThresholdRule = rules.some(r =>
      r.conditions?.some(c => c.type === 'allocation')
    );
    if (!hasThresholdRule) {
      issues.push({
        severity: 'medium',
        category: 'risk',
        title: 'No Drift Protection',
        description: 'No allocation drift threshold configured',
        impact: 'Portfolio may drift significantly from target allocation',
        recommendation: 'Add allocation drift threshold rule (e.g., rebalance if >5% drift)',
      });
    } else {
      strengths.push('Drift protection enabled');
    }

    return { issues, strengths };
  }

  /**
   * Analyze risk exposure
   */
  private analyzeRisk(config: VaultConfig): {
    issues: StrategyIssue[];
    strengths: string[];
  } {
    const issues: StrategyIssue[] = [];
    const strengths: string[] = [];

    // Check for stablecoin allocation
    const assets = config.assets || [];
    const stablecoins = ['USDC', 'USDT', 'DAI'];
    const stablecoinAllocation = assets
      .filter(a => stablecoins.includes(a.assetCode?.toUpperCase() || ''))
      .reduce((sum, a) => sum + (a.percentage || 0), 0);

    if (stablecoinAllocation === 0) {
      issues.push({
        severity: 'medium',
        category: 'risk',
        title: 'No Stablecoin Buffer',
        description: '100% allocated to volatile assets',
        impact: 'High exposure to market volatility without stable value anchor',
        recommendation: 'Consider allocating 10-30% to stablecoins for stability',
      });
    } else if (stablecoinAllocation > 0 && stablecoinAllocation < 80) {
      strengths.push('Balanced volatile/stable asset mix');
    }

    if (stablecoinAllocation > 80) {
      issues.push({
        severity: 'low',
        category: 'performance',
        title: 'Overly Conservative',
        description: `${stablecoinAllocation}% in stablecoins`,
        impact: 'Limited upside potential; may underperform in bull markets',
        recommendation: 'Consider increasing exposure to growth assets',
      });
    }

    return { issues, strengths };
  }

  /**
   * Calculate diversification score
   */
  private calculateDiversificationScore(config: VaultConfig): number {
    const assets = config.assets || [];
    
    if (assets.length === 0) return 0;
    if (assets.length === 1) return 20;

    // Number of assets (max 40 points)
    const assetCountScore = Math.min((assets.length / 5) * 40, 40);

    // Allocation balance (max 40 points) - using Herfindahl index inverse
    const allocations = assets.map(a => (a.percentage || 0) / 100);
    const herfindahl = allocations.reduce((sum, a) => sum + a * a, 0);
    const balanceScore = (1 - herfindahl) * 40;

    // Asset type diversity (max 20 points)
    const hasStablecoin = assets.some(a => 
      ['USDC', 'USDT', 'DAI'].includes(a.assetCode?.toUpperCase() || '')
    );
    const typeScore = hasStablecoin ? 20 : 10;

    return Math.round(assetCountScore + balanceScore + typeScore);
  }

  /**
   * Calculate efficiency score
   */
  private calculateEfficiencyScore(config: VaultConfig): number {
    const rules = config.rules || [];
    
    if (rules.length === 0) return 0;

    // Rule count (max 30 points)
    const ruleScore = Math.min((rules.length / 3) * 30, 30);

    // Rule diversity (max 40 points)
    const hasTimeRule = rules.some(r =>
      r.conditions?.some(c => c.type === 'time')
    );
    const hasThresholdRule = rules.some(r =>
      r.conditions?.some(c => c.type === 'allocation')
    );
    const diversityScore = (hasTimeRule ? 20 : 0) + (hasThresholdRule ? 20 : 0);

    // Allocation completeness (max 30 points)
    const assets = config.assets || [];
    const totalAllocation = assets.reduce((sum, a) => sum + (a.percentage || 0), 0);
    const allocationScore = Math.abs(totalAllocation - 100) < 1 ? 30 : 15;

    return Math.round(ruleScore + diversityScore + allocationScore);
  }

  /**
   * Calculate overall strategy score
   */
  private calculateOverallScore(
    issues: StrategyIssue[],
    diversificationScore: number,
    efficiencyScore: number
  ): number {
    // Start with average of sub-scores
    let score = (diversificationScore + efficiencyScore) / 2;

    // Deduct points for issues
    issues.forEach(issue => {
      if (issue.severity === 'high') score -= 15;
      else if (issue.severity === 'medium') score -= 8;
      else if (issue.severity === 'low') score -= 3;
    });

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Determine overall risk level
   */
  private determineRiskLevel(
    issues: StrategyIssue[],
    config: VaultConfig
  ): 'low' | 'medium' | 'high' {
    const highRiskIssues = issues.filter(i => i.category === 'risk' && i.severity === 'high').length;
    const mediumRiskIssues = issues.filter(i => i.category === 'risk' && i.severity === 'medium').length;

    if (highRiskIssues > 0) return 'high';
    if (mediumRiskIssues >= 2) return 'high';
    if (mediumRiskIssues === 1) return 'medium';

    // Check stablecoin allocation
    const assets = config.assets || [];
    const stablecoins = ['USDC', 'USDT', 'DAI'];
    const stablecoinAllocation = assets
      .filter(a => stablecoins.includes(a.assetCode?.toUpperCase() || ''))
      .reduce((sum, a) => sum + (a.percentage || 0), 0);

    if (stablecoinAllocation === 0) return 'high';
    if (stablecoinAllocation < 20) return 'medium';
    
    return 'low';
  }
}

// Export singleton instance
export const strategyAnalyzer = new StrategyAnalyzer();
