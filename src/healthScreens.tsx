import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { connectHealth, hasHealthAccess, healthStatus, HealthStatus, manageHealth, recentSessions, Session, sessionLine, stepsSince, typeName } from './health';
import { dayName, timeText } from './phase';
import { color } from './theme';
import { Button, Card, Hero, LinkButton, T, topInset } from './ui';

const page = { paddingTop: topInset, paddingHorizontal: 20, paddingBottom: 24, gap: 16 } as const;

/** Shows what Health Connect holds for the last 7 days, so you can check that your watch is reaching it. */
export function HealthScreen({ onBack }: { onBack: () => void }) {
  const [status, setStatus] = useState<HealthStatus | null>(null);
  const [access, setAccess] = useState(false);
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [steps, setSteps] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setProblem(null);
    try {
      const st = await healthStatus();
      setStatus(st);
      if (st !== 'ready') return;
      const ok = await hasHealthAccess();
      setAccess(ok);
      if (!ok) return;
      const now = Date.now();
      const midnight = new Date(now);
      midnight.setHours(0, 0, 0, 0);
      setSessions(await recentSessions(7, now));
      setSteps(await stepsSince(midnight.getTime(), now));
    } catch {
      setProblem('Could not read Health Connect. Try again.');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const connect = async () => {
    setBusy(true);
    const ok = await connectHealth();
    setAccess(ok);
    if (!ok) setProblem('Not allowed yet. Tap Connect and allow exercise, steps and distance.');
    setBusy(false);
    if (ok) load();
  };

  return (
    <View style={{ flex: 1, backgroundColor: color.black }}>
      <ScrollView contentContainerStyle={page}>
        <View>
          <Pressable accessibilityRole="button" onPress={onBack} style={{ minHeight: 48, justifyContent: 'center' }}>
            <T size={16} weight="semibold" tint={color.text2}>
              ‹ Settings
            </T>
          </Pressable>
          <Hero size={34} tint={color.text}>
            Health Connect
          </Hero>
        </View>

        <Card pad={16} style={{ gap: 6 }}>
          <T size={15} weight="bold">
            Count runs from your watch
          </T>
          <T size={14} tint={color.text2}>
            Your watch app (Fitbit, Google Health, Samsung Health) saves runs to Health Connect on your phone. IRRITATOR can read them when you log a run. It only reads. Nothing is sent anywhere.
          </T>
        </Card>

        {status === null ? (
          <T size={15} tint={color.text2}>
            Checking…
          </T>
        ) : status === 'ios' ? (
          <T size={15} tint={color.text2}>
            Health Connect is on Android only.
          </T>
        ) : status === 'missing' ? (
          <Card pad={16}>
            <T size={15} weight="semibold" tint={color.yellow}>
              This version of the app cannot read Health Connect. Install the newest app version, then open this screen again.
            </T>
          </Card>
        ) : status === 'unavailable' || status === 'update' ? (
          <Card pad={16} style={{ gap: 8 }}>
            <T size={15} weight="semibold" tint={color.yellow}>
              {status === 'update' ? 'Health Connect needs an update.' : 'Health Connect is not on this phone.'}
            </T>
            <T size={14} tint={color.text2}>
              Get it from the Play Store (Health Connect by Android), then open this screen again.
            </T>
          </Card>
        ) : !access ? (
          <View style={{ gap: 10 }}>
            <Button label="Connect Health Connect" onPress={connect} disabled={busy} />
            <T size={14} tint={color.text2}>
              Android will ask you to allow exercise, steps and distance. You can take it back any time in Health Connect.
            </T>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            <Card pad={16} style={{ gap: 4 }}>
              <T size={14} weight="semibold" tint={color.text2}>
                Steps today
              </T>
              <Hero size={40} tint={color.text} fit>
                {steps == null ? 'Unknown' : String(steps)}
              </Hero>
            </Card>

            <T size={14} weight="semibold" tint={color.text2}>
              Exercise in the last 7 days
            </T>
            {sessions && sessions.length ? (
              <Card pad={8}>
                {sessions.slice(0, 20).map((s, i) => (
                  <View key={s.id} style={{ minHeight: 60, justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: i === 0 ? 0 : 1, borderColor: color.line }}>
                    <T size={16} weight="semibold">
                      {`${typeName(s.type)}, ${dayName(s.start)} ${timeText(s.start)}`}
                    </T>
                    <T size={13} tint={color.text2}>
                      {sessionLine(s)}
                    </T>
                  </View>
                ))}
              </Card>
            ) : (
              <Card pad={16}>
                <T size={14} tint={color.text2}>
                  {sessions ? 'Nothing here yet. Do a run with your watch, open the watch app so it syncs, wait a minute, then tap Refresh.' : 'Loading…'}
                </T>
              </Card>
            )}
            <Button label={busy ? 'Reading…' : 'Refresh'} onPress={load} disabled={busy} />
            <T size={13} tint={color.text2}>
              A run counts when it lasts 10 minutes or more. Walks and other exercise are shown here but not counted as runs.
            </T>
            <LinkButton label="Open Health Connect" onPress={manageHealth} />
          </View>
        )}

        {problem ? (
          <T size={15} weight="semibold" tint={color.yellow}>
            {problem}
          </T>
        ) : null}
      </ScrollView>
    </View>
  );
}
