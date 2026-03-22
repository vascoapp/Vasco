// =============================================================================
// CERT RENEWAL PLANNER GENERATOR — Site Lead specific
// =============================================================================
// Analyzes worker certificates to detect upcoming batch expirations,
// staggered renewal opportunities, and compliance gaps.
// =============================================================================

import { useState, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ScoredInsight, GeneratorContext } from './types';
import { logPrediction } from '../calibration';
import { gt } from '../generatorTranslations';

interface WorkerCert {
  name: string;
  type: string;
  expiryDate: string;
  status: 'valid' | 'expiring' | 'expired' | 'missing';
}

interface WorkerProfile {
  id: string;
  name: string;
  trade: string;
  certs: WorkerCert[];
}

function useWorkerCerts(): WorkerProfile[] {
  const [workers, setWorkers] = useState<WorkerProfile[]>([]);
  useEffect(() => {
    AsyncStorage.getItem('@vasco_sl_workers').then(raw => {
      if (raw) setWorkers(JSON.parse(raw));
    }).catch(() => {});
  }, []);
  return workers;
}

export function useCertRenewalPlannerInsight(ctx: GeneratorContext): ScoredInsight | null {
  const workers = useWorkerCerts();

  return useMemo(() => {
    if (workers.length === 0) return null;

    const allCerts = workers.flatMap(w => w.certs.map(c => ({ ...c, workerName: w.name, trade: w.trade })));
    if (allCerts.length === 0) return null;

    const now = ctx.now;

    // Count by status
    const expired = allCerts.filter(c => c.status === 'expired');
    const expiring = allCerts.filter(c => c.status === 'expiring');
    const missing = allCerts.filter(c => c.status === 'missing');

    // Find workers with ANY expired cert (they can't legally work on certain tasks)
    const workersWithExpired = new Set(expired.map(c => c.workerName));
    const workersWithExpiring = new Set(expiring.map(c => c.workerName));

    // Detect batch expirations (multiple certs expiring in same month)
    const expiringByMonth: Record<string, typeof expiring> = {};
    for (const c of expiring) {
      const month = c.expiryDate.substring(0, 7); // YYYY-MM
      if (!expiringByMonth[month]) expiringByMonth[month] = [];
      expiringByMonth[month].push(c);
    }
    const batchMonths = Object.entries(expiringByMonth).filter(([, certs]) => certs.length >= 2);

    const totalIssues = expired.length + expiring.length + missing.length;
    if (totalIssues === 0) return null;

    logPrediction({
      generatorId: 'cert-renewal-planner',
      predictedAt: new Date().toISOString(),
      prediction: `${expired.length} verlopen, ${expiring.length} bijna verlopen, ${missing.length} ontbrekend`,
      predictedValue: totalIssues,
    });

    const priority = expired.length > 0 ? 'high' : expiring.length >= 3 ? 'medium' : 'low';

    let title: string;
    let message: string;
    let observation: string;
    let suggestion: string;

    if (expired.length > 0) {
      const names = [...workersWithExpired].slice(0, 3).join(', ');
      title = `${expired.length} verlopen certificaat${expired.length > 1 ? 'en' : ''}`;
      message = `${names}${workersWithExpired.size > 3 ? ` en ${workersWithExpired.size - 3} anderen` : ''} ${workersWithExpired.size === 1 ? 'heeft' : 'hebben'} verlopen certificaten. Deze medewerkers mogen bepaalde werkzaamheden niet uitvoeren.`;
      observation = `${expired.length} verlopen certificaten bij ${workersWithExpired.size} medewerkers`;
      suggestion = `Start direct het vernieuwingsproces. Gemiddelde doorlooptijd is 2-4 weken.`;
    } else if (batchMonths.length > 0) {
      const [month, certs] = batchMonths[0];
      const monthDate = new Date(month + '-01');
      const monthName = monthDate.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' });
      title = `${certs.length} certificaten verlopen in ${monthName}`;
      message = `Meerdere certificaten verlopen tegelijk. Plan de vernieuwingen gespreid in om piekkosten te vermijden.`;
      observation = `${certs.length} certificaten verlopen tegelijkertijd in ${monthName}`;
      suggestion = 'Spreid vernieuwingen — begin nu met de eerste om piekbelasting te voorkomen';
    } else {
      const soonestCert = expiring.sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))[0];
      const daysUntil = Math.ceil((new Date(soonestCert.expiryDate).getTime() - now.getTime()) / 86400000);
      title = `${expiring.length} certificaat${expiring.length > 1 ? 'en' : ''} bijna verlopen`;
      message = `${soonestCert.workerName}: ${soonestCert.name} verloopt over ${daysUntil} dagen. Plan de vernieuwing tijdig in.`;
      observation = `${expiring.length} certificaten verlopen binnenkort, eerste over ${daysUntil} dagen`;
      suggestion = `Start de vernieuwing voor ${soonestCert.name} — gemiddelde doorlooptijd is 2-4 weken`;
    }

    return {
      id: `cert-renewal-planner-${Date.now()}`,
      generatorId: 'cert-renewal-planner',
      category: 'compliance',
      priority,
      title,
      message,
      icon: 'ribbon',
      actionLabel: 'Certificaten',
      actionRoute: '/sitelead/worker-certs',
      source: gt('source_cert_planner', ctx.language),

      rootCauseTags: ['compliance', 'certification', 'workforce'],
      rawScore: 0,
      reasoning: {
        observation,
        evidence: `Op basis van ${allCerts.length} certificaten van ${workers.length} medewerkers`,
        implication: expired.length > 0
          ? 'Verlopen certificaten leiden tot werkstop en mogelijke boetes'
          : 'Tijdig vernieuwen voorkomt werkonderbrekingen en nalevingsproblemen',
        suggestion,
      },
      dataPoints: allCerts.length,
      confidence: 0.95,
      freshness: 1,
      action: {
        type: 'renew_cert',
        label: gt('action_renew_cert', ctx.language),
        params: { totalIssues, expiredCount: expired.length },
        requiresApproval: false,
        estimatedImpact: expired.length > 0 ? gt('cert_planner_prevent_stop', ctx.language) : gt('cert_planner_spread', ctx.language),
      },
    };
  }, [workers]);
}
