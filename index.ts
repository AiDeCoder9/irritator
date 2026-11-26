import { registerRootComponent } from 'expo';
import notifee from 'react-native-notify-kit';

import App from './App';

// Required by the notification library. Our state is time-based, so there is nothing to handle here.
notifee.onBackgroundEvent(async () => {});

registerRootComponent(App);
