export const Strings = {
  app_name: 'Smart Nap Timer',

  // Home screen
  home_title: 'How long do you want to sleep?',
  home_start_button: 'Start Nap',
  home_predicted_latency: 'Estimated time to fall asleep',
  home_learning_status: (current: number, total: number) => `Learning your pattern (${current}/${total})`,
  home_ai_active: 'AI active',

  // Monitoring screen
  monitoring_title: 'Detecting sleep...',
  monitoring_latency: 'Time since start',
  monitoring_confidence: 'Sleep confidence',
  monitoring_method_accel: 'Accelerometer',
  monitoring_method_mic: 'Microphone',
  monitoring_method_combo: 'Accel + Mic',
  monitoring_method_tap: 'Manual tap',
  monitoring_tap_fallback: "Tap when you're drifting off",
  monitoring_cancel: 'Cancel',

  // Sleeping screen
  sleeping_title: 'Sleep well',
  sleeping_countdown: 'Real sleep remaining',

  // Wake screen
  wake_title: 'Good morning!',
  wake_rate_prompt: 'How do you feel?',
  wake_target: 'Target',
  wake_actual: 'Actual sleep',
  wake_latency: 'Time to fall asleep',
  wake_method: 'Detected via',
  wake_insufficient_title: "You didn't get enough sleep",
  wake_insufficient_body: (actual: number, target: number) =>
    `You got ${actual} min of real sleep (target: ${target} min). Missing: ${target - actual} min.`,
  wake_done: 'Done',
  wake_snooze: 'Snooze 10 min',

  // Dashboard
  dashboard_title: 'Your Sleep Stats',
  dashboard_total_naps: 'Total naps',
  dashboard_avg_latency: 'Avg time to sleep',
  dashboard_avg_sleep: 'Avg actual sleep',
  dashboard_best_rating: 'Best wake rating',
  dashboard_trend_title: 'Sleep latency trend',
  dashboard_insufficient_warning: 'You have had insufficient sleep 3 sessions in a row.',

  // Settings
  settings_title: 'Settings',
  settings_sound: 'White noise sound',
  settings_volume: 'Volume',
  settings_sensitivity: 'Detection sensitivity',
  settings_reset_threshold: 'Reset learning data',
  settings_export: 'Export session data',
  settings_permissions: 'Permissions',
  settings_reset_confirm: 'This will delete all your session history and restart learning from scratch.',

  // Onboarding
  onboarding_welcome_title: 'Sleep smarter, not harder',
  onboarding_welcome_body: 'Smart Nap Timer detects when you actually fall asleep, then starts your countdown from that moment.',
  onboarding_placement_title: 'Place your phone like this',
  onboarding_placement_body: 'Place your phone face-down on the mattress beside your hip. You do not need to hold it.',
  onboarding_permissions_title: 'A few permissions needed',
  onboarding_permissions_body: 'Motion sensors and microphone help detect your sleep. Notifications fire your alarm even when the screen is off.',
  onboarding_how_title: 'How it works',
  onboarding_how_body: 'The app monitors stillness and breathing rhythm. When you are asleep, your real countdown begins.',
  onboarding_get_started: 'Get Started',
  onboarding_next: 'Next',
  onboarding_skip: 'Skip',
};
