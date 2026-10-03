/**
 * Clocked hours can be corrected, added by hand and deleted — and the JOB's
 * timeEntries (payroll, labour cost, hours-based invoices) follow (aannemer
 * walk, 2026-10-03: a forgotten clock-out could not be fixed at all).
 *
 * ONE test per file — the harness keeps a module-scoped AppState.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { act } from 'react-test-renderer';
import { walkScreen, teardown } from '../src/test-utils/screenWalk';
import { localDateKey } from '../src/utils/dateKey';
import nl from '../src/i18n/locales/nl.json';

const JOB_LABEL = (nl as any).timesheet.edit.job as string;

const Screen = () => require('../app/contractor/timesheet').default;
const run = process.env.WALK_POSTURE === 'fresh' ? describe.skip : describe;
const settle = async () => { for (let i = 0; i < 10; i++) await act(async () => { await new Promise((res) => setTimeout(res, 0)); }); };
const TODAY = localDateKey(new Date());
const NOW = new Date().toISOString();
const storedJob = async () => JSON.parse((await AsyncStorage.getItem('@vasco_jobs')) ?? '[]').find((j: any) => j.id === 'j1');

run('timesheet corrections', () => {
  it('edits, adds and deletes entries, and the job follows', async () => {
    await AsyncStorage.clear();
    await AsyncStorage.setItem('@vasco_seed_version', '2026-03-25-v4');
    await AsyncStorage.setItem('@vasco_jobs', JSON.stringify([{
      id: 'j1', title: 'CV-ketel onderhoud', customerId: 'c1', status: 'in-progress', priority: 'normal', createdAt: NOW, scheduledDate: TODAY,
      timeEntries: [{ id: 'te-1', date: TODAY, hours: 9, clockIn: '07:00', clockOut: '16:00' }], actualHours: 9,
    }]));
    await AsyncStorage.setItem('@vasco_timesheet_entries', JSON.stringify([
      { id: 'te-1', date: TODAY, clockIn: '07:00', clockOut: '16:00', breakMinutes: 0, jobId: 'j1', jobTitle: 'CV-ketel onderhoud', totalHours: 9 },
    ]));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const r = await walkScreen(Screen(), { as: 'aannemer', settlePasses: 14 });
    expect(r.error).toBeNull();
    const root = (r.tree as any).root;
    const byId = (id: string) => root.findAll((n: any) => n.props?.testID === id && (typeof n.props?.onPress === 'function' || typeof n.props?.onChangeText === 'function'), { deep: true })[0];
    const press = async (id: string) => { await act(async () => { byId(id).props.onPress(); }); await settle(); };
    const type = async (id: string, v: string) => { await act(async () => { byId(id).props.onChangeText(v); }); };

    // Edit: the forgotten clock-out, 16:00 → 11:30.
    await press('time-entry-te-1');
    await type('time-entry-end', '11:30');
    await press('time-entry-save');
    expect((await storedJob()).timeEntries).toEqual([{ id: 'te-1', date: TODAY, hours: 4.5, clockIn: '07:00', clockOut: '11:30' }]);
    expect((await storedJob()).actualHours).toBe(4.5);

    // An inverted pair is refused, nothing written.
    await press('time-entry-add');
    await type('time-entry-start', '15:00');
    await type('time-entry-end', '13:00');
    await press('time-entry-save');
    expect(alert).toHaveBeenCalled();
    expect((await storedJob()).timeEntries).toHaveLength(1);

    // Add by hand, on the job.
    await type('time-entry-start', '13:00');
    await type('time-entry-end', '15:00');
    // The sheet's own job menu (the clock-in menu above lists the same jobs).
    const menu = root.findAll((n: any) => Array.isArray(n.props?.items) && n.props.accessibilityLabel === JOB_LABEL, { deep: true })[0];
    expect(menu).toBeDefined();
    await act(async () => { menu.props.items.find((i: any) => i.key === 'j1').onPress(); });
    await press('time-entry-save');
    expect((await storedJob()).timeEntries).toHaveLength(2);
    expect((await storedJob()).actualHours).toBe(6.5);

    // Delete te-1, confirmed.
    alert.mockClear();
    await press('time-entry-te-1');
    await press('time-entry-delete');
    const confirm = alert.mock.calls[alert.mock.calls.length - 1][2] as Array<{ style?: string; onPress?: () => void }>;
    await act(async () => { confirm.find((b) => b.style === 'destructive')!.onPress!(); });
    await settle();
    expect((await storedJob()).timeEntries.map((e: any) => e.id)).not.toContain('te-1');
    expect((await storedJob()).actualHours).toBe(2);
    alert.mockRestore();
    teardown(r);
  });
});
