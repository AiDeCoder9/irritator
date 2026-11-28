import * as Updates from 'expo-updates';
import { useState } from 'react';
import { ScrollView, Share, TextInput, View } from 'react-native';

import { applyBackup, backupText, parseBackup, type Parsed } from './backup';
import { dateText } from './goalCore';
import { color, font } from './theme';
import { Button, Card, Hero, LinkButton, T, topInset } from './ui';

const input = { minHeight: 120, borderRadius: 16, backgroundColor: color.surface2, color: color.text, fontFamily: font.body, fontSize: 14, padding: 14, textAlignVertical: 'top' } as const;

/** Share a backup, or paste one to restore. Text only, so it needs no new permissions. */
export function BackupScreen({ onBack }: { onBack: () => void }) {
  const [text, setText] = useState('');
  const [checked, setChecked] = useState<Parsed | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const share = async () => {
    setProblem(null);
    try {
      await Share.share({ message: backupText(), title: 'IRRITATOR backup' });
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e));
    }
  };

  const check = () => {
    setProblem(null);
    const r = parseBackup(text);
    setChecked(r);
    if (!r.ok) setProblem(r.message);
  };

  const restore = async () => {
    if (!checked || !checked.ok) return;
    try {
      applyBackup(checked.parts);
      setDone(true);
      await Updates.reloadAsync();
    } catch {
      // Reloading can fail in some builds. The data is already saved, so a full restart does it.
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: color.black }}>
      <ScrollView contentContainerStyle={{ paddingTop: topInset, paddingHorizontal: 20, paddingBottom: 32, gap: 16 }} keyboardShouldPersistTaps="handled">
        <View>
          <LinkButton label="‹ Settings" onPress={onBack} />
          <Hero size={34} tint={color.text}>
            Backup and restore
          </Hero>
        </View>

        {done ? (
          <Card pad={18} style={{ gap: 6 }}>
            <T size={17} weight="bold" tint={color.yellow}>
              Restored.
            </T>
            <T size={15} tint={color.text2}>
              Close the app fully and open it again. Then turn your alarm on from Today, because alarms are not carried over.
            </T>
          </Card>
        ) : (
          <>
            <Card pad={18} style={{ gap: 10 }}>
              <T size={17} weight="bold">
                Back up
              </T>
              <T size={14} tint={color.text2}>
                Saves your streak, history, goals, water, food, Starter walks and settings as text. Send it to yourself (Notes, email, a chat with yourself). It also holds your weight, home and gym places and health answers, so share it only with yourself. Your USDA key is left out.
              </T>
              <Button label="Share backup" onPress={share} />
            </Card>

            <Card pad={18} style={{ gap: 10 }}>
              <T size={17} weight="bold">
                Restore
              </T>
              <T size={14} tint={color.text2}>
                Paste a backup here. It replaces everything on this phone, so do this on a new phone or after a reset.
              </T>
              <TextInput
                value={text}
                onChangeText={(t) => {
                  setText(t);
                  setChecked(null);
                }}
                multiline
                placeholder="Paste your backup here"
                placeholderTextColor={color.text2}
                accessibilityLabel="Backup text"
                style={input}
              />
              {checked && checked.ok ? (
                <View style={{ gap: 6 }}>
                  <T size={15} weight="bold" tint={color.yellow}>{`Backup from ${dateText(checked.at)}`}</T>
                  {checked.lines.map((l) => (
                    <T key={l} size={14} tint={color.text2}>
                      {l}
                    </T>
                  ))}
                  <T size={14} weight="semibold">This replaces everything on this phone. It cannot be undone.</T>
                  <Button label="Replace my data" onPress={restore} />
                </View>
              ) : (
                <Button label="Check backup" onPress={check} bg={color.surface2} fg={color.text} height={52} disabled={text.trim().length < 20} />
              )}
              {problem ? (
                <T size={14} weight="semibold" tint={color.yellow}>
                  {problem}
                </T>
              ) : null}
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
}
