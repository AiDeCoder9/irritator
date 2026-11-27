import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, View } from 'react-native';

import { color } from './theme';
import { Button, T } from './ui';

type Pick = (hour: number, minute: number) => void;

/** Time picker for both platforms. Android opens its own dialog; iOS shows a sheet. Render `sheet` once in the screen. */
export function useTimePicker(title = 'Alarm time') {
  const [shown, setShown] = useState(false);
  const [draft, setDraft] = useState(new Date());
  const [onPick, setOnPick] = useState<Pick>(() => () => {});

  const open = (hour: number, minute: number, pick: Pick) => {
    const d = new Date();
    d.setHours(hour, minute, 0, 0);
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: d,
        mode: 'time',
        is24Hour: false,
        onChange: (e, picked) => {
          if (e.type === 'set' && picked) pick(picked.getHours(), picked.getMinutes());
        },
      });
      return;
    }
    setDraft(d);
    setOnPick(() => pick);
    setShown(true);
  };

  const sheet =
    Platform.OS === 'ios' ? (
      <Modal transparent animationType="slide" visible={shown} onRequestClose={() => setShown(false)}>
        <Pressable style={{ flex: 1, backgroundColor: '#000000AA' }} onPress={() => setShown(false)} accessibilityLabel="Close" />
        <View style={{ backgroundColor: color.surface, padding: 20, paddingBottom: 34, gap: 12 }}>
          <T size={17} weight="bold">
            {title}
          </T>
          <DateTimePicker value={draft} mode="time" display="spinner" themeVariant="dark" onChange={(_, d) => d && setDraft(d)} />
          <Button
            label="Done"
            onPress={() => {
              onPick(draft.getHours(), draft.getMinutes());
              setShown(false);
            }}
          />
        </View>
      </Modal>
    ) : null;

  return { open, sheet };
}
