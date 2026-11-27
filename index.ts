import { registerRootComponent } from 'expo';
import notifee, { Event, EventType } from 'react-native-notify-kit';

import App from './App';
import { handleWaterAction } from './src/water';

// Water buttons on a notification log a drink without opening the app. Everything else is time-based, so there is nothing to handle.
async function onEvent({ type, detail }: Event) {
  if (type === EventType.ACTION_PRESS) {
    await handleWaterAction(detail.pressAction?.id, detail.notification?.id);
  }
}
notifee.onBackgroundEvent(onEvent);
notifee.onForegroundEvent(onEvent);

registerRootComponent(App);
