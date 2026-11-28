import { registerRootComponent } from 'expo';
import notifee, { Event, EventType } from 'react-native-notify-kit';

import App from './App';
import { emitRoute } from './src/nav';
import { handleWaterAction } from './src/water';

// Water buttons on a notification log a drink without opening the app. Everything else is time-based, so there is nothing to handle.
async function onEvent({ type, detail }: Event) {
  if (type === EventType.ACTION_PRESS) {
    await handleWaterAction(detail.pressAction?.id, detail.notification?.id);
  }
  // Tapping the Sunday review reminder opens the review.
  if (type === EventType.PRESS && typeof detail.notification?.data?.route === 'string') {
    emitRoute(detail.notification.data.route);
  }
}
notifee.onBackgroundEvent(onEvent);
notifee.onForegroundEvent(onEvent);

registerRootComponent(App);
