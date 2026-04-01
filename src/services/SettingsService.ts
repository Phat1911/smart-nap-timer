import AsyncStorage from '@react-native-async-storage/async-storage';
import { AlarmSoundId, DEFAULT_ALARM_SOUND } from '../constants/config';

const ALARM_SOUND_KEY = '@smart_nap_timer:alarm_sound';

export async function getAlarmSound(): Promise<AlarmSoundId> {
  try {
    const val = await AsyncStorage.getItem(ALARM_SOUND_KEY);
    return (val as AlarmSoundId) ?? DEFAULT_ALARM_SOUND;
  } catch {
    return DEFAULT_ALARM_SOUND;
  }
}

export async function setAlarmSound(id: AlarmSoundId): Promise<void> {
  await AsyncStorage.setItem(ALARM_SOUND_KEY, id);
}
