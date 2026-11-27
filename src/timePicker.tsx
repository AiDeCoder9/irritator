import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, View } from 'react-native';

import type { State } from './store';
import { color } from './theme';
import { Button, T } from './ui';

type Change = (p: Partial<State>) => void;

/** Time picker for both platforms. Android opens its own dialog; iOS shows a sheet. Render `sheet` once in the screen. */
export function useTimePicker(s: State, onChange: Change) {
  const [shown, setShown] = useState(false);
  const [draft, setDraft] = useState(new Date());

  const current = () => {
    const d = new Date();
    d.setHours(s.alarmHour, s.alarmMinute, 0, 0);
    return d;
  };

  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: current(),
        mode: 'time',
        is24Hour: false,
        onChange: (e, picked) => {
          if (e.type === 'set' && picked) onChange({ alarmHour: picked.getHours(), alarmMinute: picked.getMinutes() });
        },
      });
      return;
    }
    setDraft(current());
    setShown(true);
  };

  const sheet =
    Platform.OS === 'ios' ? (
      <Modal transparent animationType="slide" visible={shown} onRequestClose={() => setShown(false)}>
        <Pressable style={{ flex: 1, backgroundColor: '#000000AA' }} onPress={() => setShown(false)} accessibilityLabel="Close" />
        <View style={{ backgroundColor: color.surface, padding: 20, paddingBottom: 34, gap: 12 }}>
          <T size={17} weight="bold">
            Alarm time
          </T>
          <DateTimePicker value={draft} mode="time" display="spinner" themeVariant="dark" onChange={(_, d) => d && setDraft(d)} />
          <Button
            label="Done"
            onPress={() => {
              onChange({ alarmHour: draft.getHours(), alarmMinute: draft.getMinutes() });
              setShown(false);
            }}
          />
        </View>
      </Modal>
    ) : null;

  return { open, sheet };
}
