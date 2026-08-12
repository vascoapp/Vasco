/**
 * The projects LIST and the project DETAIL disagreed about one project.
 *
 * On the demo aannemer the card read "Voortgang 0%" (completed jobs / total
 * jobs = 0/1) while opening that same project showed "Sloopwerk gereed" ticked
 * in its milestone plan. A renovation GC plans in trade milestones — the
 * project templates write 7 to 11 of them — so the plan is what states how far
 * along the work is.
 */
import { isJobDone, projectProgress } from '../projectProgress';

const ms = (...done: boolean[]) => done.map((completed, i) => ({ completed, id: `m${i}` }));

describe('projectProgress', () => {
  it('measures against the milestone plan when one exists', () => {
    // The exact case from the device: one unfinished job, one ticked milestone.
    const p = projectProgress(ms(true, false, false, false, false, false, false), ['in-progress']);
    expect(p.basis).toBe('milestones');
    expect(p.pct).toBe(14);
    expect(p.completed).toBe(1);
    expect(p.total).toBe(7);
  });

  it('does not report 0% for a project whose plan has started', () => {
    // The regression itself, stated directly.
    const p = projectProgress(ms(true, false), ['in-progress']);
    expect(p.pct).toBeGreaterThan(0);
  });

  it('falls back to jobs for a project with no plan', () => {
    // Every project created before templates existed has milestones: [].
    const p = projectProgress([], ['completed', 'in-progress']);
    expect(p.basis).toBe('jobs');
    expect(p.pct).toBe(50);
  });

  it('treats an absent milestone list the same as an empty one', () => {
    expect(projectProgress(undefined, ['completed']).basis).toBe('jobs');
    expect(projectProgress(undefined, ['completed']).pct).toBe(100);
  });

  it('reports basis "none" when there is nothing to measure', () => {
    // Callers hide the bar on this — 0% would score an empty set as no
    // progress, and the same card prints "—" for a margin it cannot compute.
    const p = projectProgress([], []);
    expect(p.basis).toBe('none');
    expect(p.pct).toBe(0);
  });

  it('reaches 100 only when the whole plan is done', () => {
    expect(projectProgress(ms(true, true), []).pct).toBe(100);
    expect(projectProgress(ms(true, true, false), []).pct).toBe(67);
  });

  it('counts both the English and Dutch done vocabularies', () => {
    // AppState carries both; counting only one silently halves the number.
    for (const s of ['completed', 'invoiced', 'paid', 'gereed', 'gefactureerd', 'betaald']) {
      expect(isJobDone(s)).toBe(true);
    }
    for (const s of ['in-progress', 'lead', 'scheduled', undefined]) {
      expect(isJobDone(s)).toBe(false);
    }
  });

  it('ignores job status entirely once a plan exists', () => {
    // Completing every job does not complete a plan nobody has ticked off.
    const p = projectProgress(ms(false, false), ['completed', 'paid']);
    expect(p.pct).toBe(0);
    expect(p.basis).toBe('milestones');
  });
});
