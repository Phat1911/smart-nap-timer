/**
 * strings.ts — English (EN) and Vietnamese (VI) UI strings for the entire app
 *
 * Responsible for:
 * - Defining the EN object: all English UI strings
 * - Defining the VI object: all Vietnamese UI strings
 * - Exporting Strings (defaults to EN) and StringsType for use in LanguageContext
 *
 * Used by:
 * - LanguageContext: provides the correct string set for the current language via useLanguage()
 * - All screens and hooks using const { strings: Strings } = useLanguage()
 * - config.ts: getLocalized helpers accept StringsType to render translated labels/tips
 *
 * Notes:
 * - Some values are functions (template literals): e.g. home_naps_remaining: (n: number) => string
 *   Must be called as a function: Strings.home_naps_remaining(napCount)
 * - The default Strings export (export const Strings = EN) is only used as a static fallback;
 *   at runtime use useLanguage() to get the correct string set for the user's selected language
 */

// ─────────────────────────────────────────
// English Strings
// ─────────────────────────────────────────

// ── English strings ────────────────────────────────────────────────────────
export const EN = {
  app_name: 'Smart Nap Timer',

  // Home
  home_title: 'How long do you want to sleep?',
  home_start_button: 'Start Nap',
  home_predicted_latency: 'Estimated time to fall asleep',
  home_learning_status: (current: number, total: number) =>
    `Learning your pattern (${current}/${total})`,
  home_ai_active: 'AI active',
  home_naps_remaining: (n: number) => `${n} nap${n === 1 ? '' : 's'} remaining today`,
  home_subtitle: 'Optimizing your circadian rhythm through restorative micro-sleeps.',
  home_recommended_badge: 'Recommended',
  home_placement_tip_title: 'Phone placement tip',
  home_placement_tip_body:
    "Place your phone face-down on the mattress beside your hip. You don't need to hold it.",
  home_placement_tip_got_it: 'Got it',
  home_placement_tip_dont_show: "Don't show again",
  home_est_fall_asleep: 'Est. fall-asleep',
  home_first_session_hint:
    'First session — using science defaults. The app will personalise after a few naps.',
  home_ai_predictions_label: 'AI Predictions',
  home_ai_upgrade_hint: 'Upgrade to Pro to unlock',
  home_best_placement_badge: 'BEST PLACEMENT FOR YOU',
  home_phone_placement_section: 'Phone placement',
  home_placements_active: (current: number, max: number) => `${current}/${max} active`,
  home_placement_pro_hint: 'Pro: combine 2 placements for better accuracy',
  home_placement_max_hint: 'Max: combine up to 4 placements for maximum accuracy',
  home_placement_primary_label: 'Primary',
  home_upgrade_placements_hint: 'Upgrade to combine placements',
  home_learning_collecting: (current: number, total: number) =>
    `Collecting data (${current}/${total})`,
  home_learning_initial: 'Learning your pattern',
  home_custom_label: 'Custom:',
  home_custom_placeholder: '___ min',
  home_ai_conf_suffix: 'conf.',
  home_habit_apply_btn: 'Apply this setup',

  // Duration suggestions
  duration_power_nap: 'Power Nap',
  duration_deep_rest: 'Deep Rest',
  duration_full_cycle: 'Full Cycle',

  // Phone placements
  placement_mattress_label: 'Mattress',
  placement_mattress_desc: 'Face-down beside your hip',
  placement_mattress_tip: 'Place face-down on the mattress beside your hip. Do not hold it.',
  placement_hand_label: 'Hand',
  placement_hand_desc: 'Held loosely in your hand',
  placement_hand_tip: 'Hold loosely. The app detects when your grip relaxes at sleep onset.',
  placement_chest_label: 'Chest',
  placement_chest_desc: 'Resting on your chest',
  placement_chest_tip: 'Rest face-up on your chest. Breathing rhythm detected directly.',
  placement_pocket_label: 'Pocket',
  placement_pocket_desc: 'In pocket or on nightstand',
  placement_pocket_tip: 'Least accurate. Use mattress or hand placement for better results.',

  // Monitoring
  monitoring_title: 'Detecting sleep...',
  monitoring_latency: 'Time since start',
  monitoring_confidence: 'Sleep confidence',
  monitoring_method_accel: 'Accelerometer',
  monitoring_method_mic: 'Microphone',
  monitoring_method_combo: 'Accel + Mic',
  monitoring_method_tap: 'Manual tap',
  monitoring_tap_fallback: "Tap when you're drifting off",
  monitoring_cancel: 'Cancel',
  monitoring_permissions_title: 'Permissions required',
  monitoring_dnd_title: 'Enable Do Not Disturb',
  monitoring_dnd_body:
    'For the best sleep detection, enable Do Not Disturb mode so notifications and calls do not wake you during monitoring.',
  monitoring_dnd_not_now: 'Not now',
  monitoring_dnd_grant: 'Grant access',
  monitoring_sensor_active: 'Active',
  monitoring_sensor_starting: 'Starting',
  monitoring_sensor_denied: 'Denied',
  monitoring_detection_method: 'Detection method',
  monitoring_white_noise: 'White noise playing',

  // Sleeping
  sleeping_title: 'Sleep well',
  sleeping_countdown: 'Real sleep remaining',
  sleeping_audio_rain: 'Rain',

  // Wake
  wake_title: 'Time to Wake Up',
  wake_rate_prompt: 'How do you feel?',
  wake_target: 'Target',
  wake_actual: 'Actual sleep',
  wake_latency: 'Time to fall asleep',
  wake_method: 'Detected via',
  wake_insufficient_title: "You didn't get enough sleep",
  wake_insufficient_body: (actual: number, target: number) =>
    `You got ${actual} min of real sleep (target: ${target} min). Missing: ${target - actual} min.`,
  wake_done: 'Dismiss',
  wake_snooze: 'Snooze 10 min',
  wake_restored_title: 'Restored',
  wake_possible_reasons:
    'Possible reasons: woke earlier than planned, try a quieter environment.',
  wake_upgrade_hint: 'Upgrade to Pro for full sleep analysis.',
  wake_suggestion_title: 'Try a shorter target',
  wake_suggestion_body: (minutes: number) =>
    `Your last few naps came up short. Consider a ${minutes}-minute target next time — it better matches your recent sleep patterns.`,
  wake_placement_eval_title: 'How was your placement?',
  wake_placement_eval_comfort: 'Was it comfortable?',
  wake_placement_eval_accuracy: 'Did it detect sleep accurately?',
  wake_eval_yes: 'Yes',
  wake_eval_too_late: 'Too late',
  wake_eval_too_early: 'Too early',
  wake_eval_not_sure: 'Not sure',
  wake_eval_no: 'No',
  wake_quality_score: 'Quality Score',
  wake_snooze_countdown: (time: string) => `Snooze: ${time}`,
  wake_cancel_snooze: 'Cancel Snooze',

  // Dashboard
  dashboard_title: 'Your Sleep Stats',
  dashboard_total_naps: 'Total naps',
  dashboard_avg_latency: 'Avg time to sleep',
  dashboard_avg_sleep: 'Avg actual sleep',
  dashboard_best_rating: 'Best wake rating',
  dashboard_trend_title: 'Sleep latency trend',
  dashboard_insufficient_warning:
    'You have had insufficient sleep 3 sessions in a row.',
  dashboard_empty_title: 'No sessions yet',
  dashboard_empty_body: 'Complete your first nap to see stats here.',
  dashboard_attention_needed: 'Attention Needed',
  dashboard_chart_sub: (n: number) => `Minutes to fall asleep (last ${n} sessions)`,
  dashboard_history_banner: (visible: number, hidden: number) =>
    `Showing last ${visible} sessions. Upgrade for full history.`,
  dashboard_upgrade_history_hint: 'Upgrade for full session history',

  // Settings
  settings_title: 'Settings',
  settings_sound: 'White noise sound',
  settings_alarm_sound: 'Alarm Sound',
  settings_volume: 'Volume',
  settings_sensitivity: 'Detection sensitivity',
  settings_reset_threshold: 'Reset learning data',
  settings_export: 'Export session data',
  settings_permissions: 'Permissions',
  settings_reset_confirm:
    'This will delete all your session history and restart learning from scratch.',
  settings_sound_rain: 'Rain',
  settings_sound_fan: 'Fan',
  settings_sound_static: 'Static',
  settings_sound_brown: 'Brown',
  settings_sensitivity_low: 'Low',
  settings_sensitivity_medium: 'Medium',
  settings_sensitivity_high: 'High',
  settings_section_data: 'Data',
  settings_perm_microphone: 'Microphone',
  settings_perm_motion: 'Motion Sensors',
  settings_perm_notifications: 'Notifications',
  settings_reset_alert_title: 'Reset Learning Data',
  settings_reset_alert_cancel: 'Cancel',
  settings_reset_alert_confirm: 'Reset',
  settings_reset_done_title: 'Done',
  settings_reset_done_body: 'Your learning data has been reset.',
  settings_export_share_title: 'Smart Nap Timer — Session Data',
  settings_export_error_title: 'Export Failed',
  settings_export_error_body: 'Could not export session data.',
  settings_export_empty_title: 'No Data',
  settings_export_empty_body: 'No sessions recorded yet.',
  settings_backup_export: 'Backup sessions',
  settings_backup_import: 'Restore from backup',
  settings_backup_export_error_title: 'Export Failed',
  settings_backup_export_error: 'Could not create session backup.',
  settings_backup_import_success_title: 'Import Complete',
  settings_backup_import_success: (imported: number, skipped: number) =>
    `Imported ${imported} session(s). ${skipped} duplicate(s) skipped.`,
  settings_backup_import_error_title: 'Import Failed',
  settings_backup_import_error: 'The file could not be read or is not a valid backup.',

  // Onboarding
  onboarding_welcome_title: 'Sleep smarter, not harder',
  onboarding_welcome_body:
    'Smart Nap Timer detects when you actually fall asleep, then starts your countdown from that moment.',
  onboarding_placement_title: 'Place your phone like this',
  onboarding_placement_body:
    'Place your phone face-down on the mattress beside your hip. You do not need to hold it.',
  onboarding_permissions_title: 'A few permissions needed',
  onboarding_permissions_body:
    'Motion sensors and microphone help detect your sleep. Notifications fire your alarm even when the screen is off.',
  onboarding_how_title: 'How it works',
  onboarding_how_body:
    'The app monitors stillness and breathing rhythm. When you are asleep, your real countdown begins.',
  onboarding_get_started: 'Get Started',
  onboarding_next: 'Next',
  onboarding_skip: 'Skip',

  // Paywall
  paywall_title: 'Upgrade your sleep',
  paywall_free_label: 'Free',
  paywall_pro_label: 'Pro',
  paywall_max_label: 'Max',
  paywall_upgrade_pro: 'UPGRADE TO PRO',
  paywall_upgrade_max: 'UPGRADE TO MAX',
  paywall_restore: 'Restore purchases',
  paywall_terms: 'Terms',
  paywall_privacy: 'Privacy',
  paywall_hero_subtitle: 'Science-backed nap optimization',
  paywall_free_tier_label: 'Baseline',
  paywall_pro_tier_label: 'Optimized Rest',
  paywall_max_tier_label: 'Elite Tier',
  paywall_current_plan: 'Current Plan',
  paywall_free_price: '$0',
  paywall_per_month: '/ month',
  paywall_most_popular: 'Most Popular',
  paywall_maybe_later: 'Maybe later',
  paywall_alert_success_title: (tier: string) => `Welcome to ${tier}!`,
  paywall_alert_success_body: 'Your plan is now active.',
  paywall_alert_cancelled_title: 'Payment Cancelled',
  paywall_alert_cancelled_body: 'Your payment was cancelled.',
  paywall_alert_pending_title: 'Payment Pending',
  paywall_alert_pending_body:
    'We could not confirm your payment yet. If you completed payment, your plan will activate shortly.',
  paywall_alert_failed_title: 'Purchase Failed',
  paywall_alert_failed_body: 'Something went wrong. Please try again.',
  paywall_alert_restored_title: 'Purchases Restored',
  paywall_alert_restored_none: 'No active purchases found.',
  paywall_alert_restored_body: (tier: string) => `Your ${tier} plan has been restored.`,
  paywall_alert_restore_failed_title: 'Restore Failed',
  paywall_alert_restore_failed_body: 'Could not restore purchases. Please try again.',
  paywall_free_features: [
    '2 naps per day',
    '7-session history',
    '1 sound (Rain)',
    '1 phone placement',
    'Science-based suggestions',
  ] as string[],
  paywall_pro_features: [
    '5 naps per day',
    '30-session history',
    '4 sounds (Rain, Fan, Static...)',
    '2 phone placements (combo fusion)',
    'AI predictions active',
    'Full insufficient sleep report',
  ] as string[],
  paywall_max_features: [
    'Unlimited naps',
    'Full session history',
    'All 4 sounds',
    'Quad placement fusion',
    'AI predictions + confidence %',
    'Full sleep reports',
    'Export session data (CSV/JSON)',
  ] as string[],

  // Suggestion reasons
  suggestion_reason_science: 'Science default',
  suggestion_reason_time_of_day: 'Recommended for this time of day',

  // Alarm notification
  alarm_notification_title: 'Wake up!',
  alarm_notification_body: (minutes: number) => `Your ${minutes}-minute nap is complete.`,

  // Paywall navigation reasons
  paywall_reason_export: 'Session export requires Max plan',
  paywall_reason_sound: (sound: string) => `${sound} sound requires a paid plan`,
  paywall_reason_ai: 'Upgrade to Pro for AI sleep predictions',
  paywall_reason_placements: 'Upgrade to Pro to combine placements',
  paywall_header_brand: 'Sleep Luxe',
  paywall_hero_unlock: 'Unlock',
  paywall_hero_sub: 'Choose the plan that fits your sleep needs and optimize your rest.',
  paywall_free_tier_name: 'FREE',
  paywall_free_downgrade_label: 'Free tier',

  // Fall-asleep limit picker (Feature 1 + 2)
  home_fall_asleep_limit_label: 'Max fall-asleep time',
  home_fall_asleep_limit_hint: 'Alarm fires if you\'re still awake after this',
  home_ai_fall_asleep_suggest: (min: number) =>
    `AI suggests: ~${min} min based on your history`,

  // Wake — fall-asleep timeout (Feature 1)
  wake_fall_asleep_timeout_title: 'Fall-asleep time ended',
  wake_fall_asleep_timeout_body:
    'The duration to fall asleep has ended. The alarm fired because you were still awake.',

  // Onboarding new slides (Feature 3)
  onboarding_fallasleep_title: 'Set your fall-asleep limit',
  onboarding_fallasleep_body:
    'Choose how long you have to fall asleep. If you\'re still awake after that time, the alarm fires immediately so you don\'t miss your rest window.',
  onboarding_ai_title: 'AI learns from every nap',
  onboarding_ai_body:
    'After 5 sessions the AI predicts how long it takes you to fall asleep at different times of day — and suggests the perfect fall-asleep limit for you.',

  // Custom alarm sounds
  settings_custom_sounds: 'Custom Alarm Sounds',
  settings_add_custom_sound: 'Add from device',
  settings_custom_sound_delete_confirm_title: 'Delete Sound',
  settings_custom_sound_delete_confirm_body: (name: string) => `Remove "${name}" from your custom sounds?`,
  settings_custom_sound_delete: 'Delete',
  settings_custom_sound_pick_error_title: 'Could not add sound',
  settings_custom_sound_pick_error: 'The selected file could not be imported.',

  // Common
  common_preview: 'Preview',
  common_cancel: 'Cancel',
  common_ok: 'OK',
  common_minutes_short: 'min',

  // Guide screen
  guide_title: 'Best Experience Guide',
  guide_intro_pre: "Smart Nap Timer uses your phone's",
  guide_intro_sensors: 'accelerometer, gyroscope, and microphone',
  guide_intro_post: 'to detect when you fall asleep — no wearables needed. Follow this guide to get the most accurate detection.',
  guide_section_placements: 'Choose Your Placement',
  guide_section_confidence: 'Understanding the Confidence Score',
  guide_section_min_time: 'Minimum Detection Times',
  guide_section_environment: 'Environment Tips',
  guide_section_ai: 'How the AI Learns',
  guide_placement_hand_best: 'Office chair, bus, plane',
  guide_placement_hand_step1: 'Rest your arm at your side with phone loosely in palm.',
  guide_placement_hand_step2: 'As you drift off, your grip naturally relaxes — this triggers detection.',
  guide_placement_hand_step3: 'When confidence reaches ~65%, gently place the phone on your chest or mattress.',
  guide_placement_hand_step4: 'Detection continues automatically. Phone can stay anywhere for the rest of the nap.',
  guide_placement_hand_warning: 'Not ideal for bed naps — holding a phone is uncomfortable lying flat.',
  guide_placement_chest_best: 'Bed, couch, recliner',
  guide_placement_chest_step1: 'Lie on your back and place the phone face-up on your chest.',
  guide_placement_chest_step2: 'The mic picks up your breathing rhythm directly from your chest vibrations.',
  guide_placement_chest_step3: 'Keep the room reasonably quiet — TV or loud music will confuse the mic.',
  guide_placement_chest_step4: 'No need to hold it — just let it rest.',
  guide_placement_mattress_best: 'Bed (lying on side)',
  guide_placement_mattress_step1: 'Place the phone face-down on the mattress beside your hip.',
  guide_placement_mattress_step2: 'Do not hold it — the mattress absorbs movement, so stillness is the key signal.',
  guide_placement_mattress_step3: 'A quiet room is more important here than any other placement.',
  guide_placement_mattress_step4: 'Detection requires slightly longer (5 min minimum) since motion signal is weak.',
  guide_placement_mattress_warning: 'Requires mic to detect breathing rhythm. Works poorly in noisy rooms.',
  guide_placement_pocket_best: 'Last resort only',
  guide_placement_pocket_step1: 'Slide phone into a pocket or place face-down on the nightstand.',
  guide_placement_pocket_step2: 'Relies almost entirely on how long you have been still.',
  guide_placement_pocket_step3: 'Expect lower accuracy — the mic is muffled and motion signal is minimal.',
  guide_placement_pocket_warning: 'Least accurate. Use Hand or Chest for better detection.',
  guide_conf_body: 'The confidence score (0–100%) combines signals from all sensors. Detection fires when the score stays above 80% for 6 consecutive seconds, with no declining trend.',
  guide_conf_awake_label: 'Awake',
  guide_conf_awake_desc: 'Movement or noise detected. Keep still and quiet.',
  guide_conf_drowsy_label: 'Drowsy',
  guide_conf_drowsy_desc: 'Signals improving. Stay still — you are drifting off.',
  guide_conf_almost_label: 'Almost there',
  guide_conf_almost_desc: 'Strong sleep signals. Detection could fire very soon.',
  guide_conf_detected_label: 'Detected',
  guide_conf_detected_desc: 'Sustained 6 seconds → sleep confirmed. Nap timer starts.',
  guide_conf_guard_pre: 'A',
  guide_conf_guard_highlight: 'false-positive guard',
  guide_conf_guard_post: 'prevents the score from reaching 80% unless both movement and breathing sensors agree — so lying still alone is not enough.',
  guide_time_body: 'The app enforces a minimum wait before detection can fire. This prevents false positives from simply lying down.',
  guide_time_hand_time: '3.5 minutes',
  guide_time_hand_note: 'Grip relaxation is a fast, clear signal',
  guide_time_chest_time: '4 minutes',
  guide_time_chest_note: 'Breathing rhythm needs time to establish',
  guide_time_mattress_time: '5 minutes',
  guide_time_mattress_note: 'Motion sensor is blind — mic needs longer',
  guide_time_pocket_time: '5 minutes',
  guide_time_pocket_note: 'Weakest signal overall',
  guide_time_movement_body: 'Movement detected after the timer starts adds an extra 90 seconds to the minimum — the clock partially resets so you must be still long enough after settling.',
  guide_env_quiet: 'Quiet room is the #1 factor. Turn off the TV and set your phone to silent before starting.',
  guide_env_cool: 'Cool rooms (18–22°C) help you fall asleep faster and improve detection accuracy.',
  guide_env_dark: 'Dim or turn off lights. Light suppresses melatonin and delays sleep onset.',
  guide_env_schedule: 'Nap at the same time each day. Your body adapts and the AI learns your rhythm.',
  guide_env_rate: 'Rate every nap after waking. The AI uses your ratings to predict sleep latency better.',
  guide_env_ai: 'The AI activates after 5 rated sessions and improves with every nap you record.',
  guide_ai_step_nap: 'Nap',
  guide_ai_step_rate: 'Rate',
  guide_ai_step_sessions: 'Sessions',
  guide_ai_step_active: 'AI active',
  guide_ai_body1_pre: 'After 5 rated sessions, the AI activates and predicts your personal sleep latency based on your',
  guide_ai_body1_highlight: 'time of day, day of week, previous session, and wake rating',
  guide_ai_body1_post: '. It suggests the best nap duration and adjusts the detection threshold to your sleep pattern.',
  guide_ai_body2: 'The more you rate, the more accurate the predictions become. Always tap the star rating on the Wake screen — even a quick 1-tap rating helps.',

  // Settings — Help section
  settings_section_help: 'Help',
  settings_guide_btn: 'Best Experience Guide',
};

// ── Vietnamese strings ─────────────────────────────────────────────────────
export const VI: typeof EN = {
  app_name: 'Đồng hồ chợp mắt',

  // Home screen
  home_title: 'Bạn muốn ngủ bao lâu?',
  home_start_button: 'Bắt đầu chợp mắt',
  home_predicted_latency: 'Thời gian dự kiến để ngủ',
  home_learning_status: (current: number, total: number) =>
    `Đang học thói quen của bạn (${current}/${total})`,
  home_ai_active: 'AI đang hoạt động',
  home_naps_remaining: (n: number) => `Còn ${n} lần chợp mắt hôm nay`,
  home_subtitle: 'Tối ưu nhịp sinh học qua những giấc ngủ ngắn phục hồi.',
  home_recommended_badge: 'Gợi ý',
  home_placement_tip_title: 'Mẹo đặt điện thoại',
  home_placement_tip_body:
    'Đặt điện thoại úp xuống trên đệm cạnh hông. Bạn không cần cầm nó.',
  home_placement_tip_got_it: 'Đã hiểu',
  home_placement_tip_dont_show: 'Không hiện lại',
  home_est_fall_asleep: 'Dự kiến ngủ',
  home_first_session_hint:
    'Lần đầu tiên — dùng mặc định khoa học. Ứng dụng sẽ cá nhân hoá sau vài lần chợp mắt.',
  home_ai_predictions_label: 'Dự đoán AI',
  home_ai_upgrade_hint: 'Nâng cấp Pro để mở khoá',
  home_best_placement_badge: 'VỊ TRÍ ĐẶT TỐT NHẤT CHO BẠN',
  home_phone_placement_section: 'Vị trí đặt điện thoại',
  home_placements_active: (current: number, max: number) =>
    `${current}/${max} đang dùng`,
  home_placement_pro_hint: 'Pro: kết hợp 2 vị trí để chính xác hơn',
  home_placement_max_hint: 'Max: kết hợp tới 4 vị trí để chính xác tối đa',
  home_placement_primary_label: 'Chính',
  home_upgrade_placements_hint: 'Nâng cấp để kết hợp nhiều vị trí',
  home_learning_collecting: (current: number, total: number) =>
    `Đang thu thập dữ liệu (${current}/${total})`,
  home_learning_initial: 'Đang học thói quen của bạn',
  home_custom_label: 'Tuỳ chỉnh:',
  home_custom_placeholder: '___ phút',
  home_ai_conf_suffix: 'tin cậy',
  home_habit_apply_btn: 'Áp dụng cài đặt này',

  // Duration suggestions
  duration_power_nap: 'Chợp mắt ngắn',
  duration_deep_rest: 'Nghỉ sâu',
  duration_full_cycle: 'Chu kỳ đầy đủ',

  // Phone placement
  placement_mattress_label: 'Nệm',
  placement_mattress_desc: 'Úp xuống cạnh hông',
  placement_mattress_tip: 'Đặt điện thoại úp xuống trên đệm cạnh hông. Không cần cầm.',
  placement_hand_label: 'Tay',
  placement_hand_desc: 'Cầm nhẹ trong tay',
  placement_hand_tip: 'Cầm nhẹ. Ứng dụng phát hiện khi tay bạn thả lỏng lúc ngủ.',
  placement_chest_label: 'Ngực',
  placement_chest_desc: 'Đặt trên ngực',
  placement_chest_tip: 'Đặt ngửa trên ngực. Nhịp thở được phát hiện trực tiếp.',
  placement_pocket_label: 'Túi',
  placement_pocket_desc: 'Trong túi hoặc trên bàn đầu giường',
  placement_pocket_tip: 'Độ chính xác thấp nhất. Dùng vị trí nệm hoặc tay để tốt hơn.',

  // Monitoring screen
  monitoring_title: 'Đang phát hiện giấc ngủ...',
  monitoring_latency: 'Thời gian từ lúc bắt đầu',
  monitoring_confidence: 'Độ tin cậy giấc ngủ',
  monitoring_method_accel: 'Gia tốc kế',
  monitoring_method_mic: 'Micrô',
  monitoring_method_combo: 'Gia tốc kế + Micrô',
  monitoring_method_tap: 'Chạm thủ công',
  monitoring_tap_fallback: 'Chạm khi bạn bắt đầu buồn ngủ',
  monitoring_cancel: 'Huỷ',
  monitoring_permissions_title: 'Cần quyền truy cập',
  monitoring_dnd_title: 'Bật chế độ Không làm phiền',
  monitoring_dnd_body:
    'Để phát hiện giấc ngủ tốt nhất, hãy bật Không làm phiền để thông báo và cuộc gọi không đánh thức bạn khi đang giám sát.',
  monitoring_dnd_not_now: 'Lúc khác',
  monitoring_dnd_grant: 'Cấp quyền',
  monitoring_sensor_active: 'Đang hoạt động',
  monitoring_sensor_starting: 'Đang khởi động',
  monitoring_sensor_denied: 'Bị từ chối',
  monitoring_detection_method: 'Phương pháp phát hiện',
  monitoring_white_noise: 'Đang phát âm thanh nền',

  // Sleeping screen
  sleeping_title: 'Ngủ ngon nhé',
  sleeping_countdown: 'Thời gian ngủ còn lại',
  sleeping_audio_rain: 'Mưa',

  // Wake screen
  wake_title: 'Đã đến giờ thức dậy',
  wake_rate_prompt: 'Bạn cảm thấy thế nào?',
  wake_target: 'Mục tiêu',
  wake_actual: 'Thực tế ngủ',
  wake_latency: 'Thời gian để ngủ',
  wake_method: 'Phát hiện qua',
  wake_insufficient_title: 'Bạn chưa ngủ đủ giấc',
  wake_insufficient_body: (actual: number, target: number) =>
    `Bạn đã ngủ ${actual} phút (mục tiêu: ${target} phút). Thiếu: ${target - actual} phút.`,
  wake_done: 'Tắt báo thức',
  wake_snooze: 'Báo lại 10 phút',
  wake_restored_title: 'Đã khôi phục',
  wake_possible_reasons:
    'Lý do có thể: thức dậy sớm hơn kế hoạch, hãy thử môi trường yên tĩnh hơn.',
  wake_upgrade_hint: 'Nâng cấp Pro để xem báo cáo giấc ngủ đầy đủ.',
  wake_suggestion_title: 'Thử mục tiêu ngắn hơn',
  wake_suggestion_body: (minutes: number) =>
    `Vài lần chợp mắt gần đây của bạn chưa đủ. Hãy thử mục tiêu ${minutes} phút lần tới — phù hợp hơn với thói quen gần đây của bạn.`,
  wake_placement_eval_title: 'Vị trí đặt máy thế nào?',
  wake_placement_eval_comfort: 'Có thoải mái không?',
  wake_placement_eval_accuracy: 'Có phát hiện giấc ngủ chính xác không?',
  wake_eval_yes: 'Có',
  wake_eval_too_late: 'Quá muộn',
  wake_eval_too_early: 'Quá sớm',
  wake_eval_not_sure: 'Không chắc',
  wake_eval_no: 'Không',
  wake_quality_score: 'Điểm chất lượng',
  wake_snooze_countdown: (time: string) => `Báo lại: ${time}`,
  wake_cancel_snooze: 'Huỷ báo lại',

  // Dashboard
  dashboard_title: 'Thống kê giấc ngủ',
  dashboard_total_naps: 'Tổng số lần chợp mắt',
  dashboard_avg_latency: 'Thời gian ngủ trung bình',
  dashboard_avg_sleep: 'Giấc ngủ thực tế trung bình',
  dashboard_best_rating: 'Đánh giá tốt nhất',
  dashboard_trend_title: 'Xu hướng thời gian ngủ',
  dashboard_insufficient_warning:
    'Bạn đã ngủ không đủ giấc 3 buổi liên tiếp.',
  dashboard_empty_title: 'Chưa có phiên nào',
  dashboard_empty_body: 'Hoàn thành lần chợp mắt đầu tiên để xem thống kê.',
  dashboard_attention_needed: 'Cần chú ý',
  dashboard_chart_sub: (n: number) => `Thời gian để ngủ (${n} phiên gần nhất)`,
  dashboard_history_banner: (visible: number, hidden: number) =>
    `Đang hiển thị ${visible} phiên gần nhất. Nâng cấp để xem toàn bộ.`,
  dashboard_upgrade_history_hint: 'Nâng cấp để xem toàn bộ lịch sử',

  // Settings
  settings_title: 'Cài đặt',
  settings_sound: 'Âm thanh nền',
  settings_alarm_sound: 'Âm thanh báo thức',
  settings_volume: 'Âm lượng',
  settings_sensitivity: 'Độ nhạy phát hiện',
  settings_reset_threshold: 'Đặt lại dữ liệu học',
  settings_export: 'Xuất dữ liệu phiên',
  settings_permissions: 'Quyền truy cập',
  settings_reset_confirm:
    'Thao tác này sẽ xoá toàn bộ lịch sử phiên và bắt đầu học lại từ đầu.',
  settings_sound_rain: 'Mưa',
  settings_sound_fan: 'Quạt',
  settings_sound_static: 'Tĩnh',
  settings_sound_brown: 'Brown',
  settings_sensitivity_low: 'Thấp',
  settings_sensitivity_medium: 'Trung bình',
  settings_sensitivity_high: 'Cao',
  settings_section_data: 'Dữ liệu',
  settings_perm_microphone: 'Micrô',
  settings_perm_motion: 'Cảm biến chuyển động',
  settings_perm_notifications: 'Thông báo',
  settings_reset_alert_title: 'Đặt lại dữ liệu học',
  settings_reset_alert_cancel: 'Huỷ',
  settings_reset_alert_confirm: 'Đặt lại',
  settings_reset_done_title: 'Hoàn tất',
  settings_reset_done_body: 'Dữ liệu học của bạn đã được đặt lại.',
  settings_export_share_title: 'Smart Nap Timer — Dữ liệu phiên',
  settings_export_error_title: 'Xuất thất bại',
  settings_export_error_body: 'Không thể xuất dữ liệu phiên.',
  settings_export_empty_title: 'Không có dữ liệu',
  settings_export_empty_body: 'Chưa có phiên nào được ghi lại.',
  settings_backup_export: 'Sao lưu phiên',
  settings_backup_import: 'Khôi phục từ sao lưu',
  settings_backup_export_error_title: 'Xuất thất bại',
  settings_backup_export_error: 'Không thể tạo bản sao lưu phiên.',
  settings_backup_import_success_title: 'Nhập hoàn tất',
  settings_backup_import_success: (imported: number, skipped: number) =>
    `Đã nhập ${imported} phiên. Bỏ qua ${skipped} phiên trùng lặp.`,
  settings_backup_import_error_title: 'Nhập thất bại',
  settings_backup_import_error: 'Không thể đọc tệp hoặc tệp không phải bản sao lưu hợp lệ.',

  // Onboarding
  onboarding_welcome_title: 'Ngủ thông minh hơn',
  onboarding_welcome_body:
    'Smart Nap Timer phát hiện khi nào bạn thực sự ngủ, rồi mới bắt đầu đếm ngược từ thời điểm đó.',
  onboarding_placement_title: 'Đặt điện thoại như thế này',
  onboarding_placement_body:
    'Đặt điện thoại úp xuống trên đệm cạnh hông. Bạn không cần cầm nó.',
  onboarding_permissions_title: 'Cần một số quyền truy cập',
  onboarding_permissions_body:
    'Cảm biến chuyển động và micrô giúp phát hiện giấc ngủ. Thông báo sẽ kích hoạt báo thức ngay cả khi màn hình tắt.',
  onboarding_how_title: 'Cách hoạt động',
  onboarding_how_body:
    'Ứng dụng theo dõi sự bất động và nhịp thở. Khi bạn đã ngủ, đồng hồ đếm ngược thực sự mới bắt đầu.',
  onboarding_get_started: 'Bắt đầu',
  onboarding_next: 'Tiếp theo',
  onboarding_skip: 'Bỏ qua',

  // Paywall screen
  paywall_title: 'Nâng cấp giấc ngủ của bạn',
  paywall_free_label: 'Miễn phí',
  paywall_pro_label: 'Pro',
  paywall_max_label: 'Max',
  paywall_upgrade_pro: 'NÂNG CẤP LÊN PRO',
  paywall_upgrade_max: 'NÂNG CẤP LÊN MAX',
  paywall_restore: 'Khôi phục giao dịch',
  paywall_terms: 'Điều khoản',
  paywall_privacy: 'Quyền riêng tư',
  paywall_hero_subtitle: 'Tối ưu hoá giấc ngủ ngắn bằng khoa học',
  paywall_free_tier_label: 'Cơ bản',
  paywall_pro_tier_label: 'Phục hồi tối ưu',
  paywall_max_tier_label: 'Đỉnh cao',
  paywall_current_plan: 'Gói hiện tại',
  paywall_free_price: 'Miễn phí',
  paywall_per_month: '/ tháng',
  paywall_most_popular: 'Phổ biến nhất',
  paywall_maybe_later: 'Để sau',
  paywall_alert_success_title: (tier: string) => `Chào mừng đến ${tier}!`,
  paywall_alert_success_body: 'Gói của bạn đã được kích hoạt.',
  paywall_alert_cancelled_title: 'Đã huỷ thanh toán',
  paywall_alert_cancelled_body: 'Thanh toán của bạn đã bị huỷ.',
  paywall_alert_pending_title: 'Đang chờ xác nhận',
  paywall_alert_pending_body:
    'Chúng tôi chưa xác nhận được thanh toán. Nếu bạn đã thanh toán, gói sẽ được kích hoạt sớm.',
  paywall_alert_failed_title: 'Thanh toán thất bại',
  paywall_alert_failed_body: 'Đã xảy ra lỗi. Vui lòng thử lại.',
  paywall_alert_restored_title: 'Đã khôi phục giao dịch',
  paywall_alert_restored_none: 'Không tìm thấy giao dịch nào.',
  paywall_alert_restored_body: (tier: string) =>
    `Gói ${tier} của bạn đã được khôi phục.`,
  paywall_alert_restore_failed_title: 'Khôi phục thất bại',
  paywall_alert_restore_failed_body: 'Không thể khôi phục giao dịch. Vui lòng thử lại.',
  paywall_free_features: [
    '2 lần chợp mắt mỗi ngày',
    '7 phiên gần nhất',
    '1 âm thanh (Mưa)',
    '1 vị trí đặt máy',
    'Gợi ý dựa trên khoa học',
  ] as string[],
  paywall_pro_features: [
    '5 lần chợp mắt mỗi ngày',
    '30 phiên gần nhất',
    '4 âm thanh (Mưa, Quạt, Tĩnh...)',
    '2 vị trí kết hợp',
    'Dự đoán AI',
    'Báo cáo ngủ không đủ giấc đầy đủ',
  ] as string[],
  paywall_max_features: [
    'Không giới hạn lần chợp mắt',
    'Toàn bộ lịch sử',
    'Tất cả 4 âm thanh',
    'Kết hợp 4 vị trí',
    'Dự đoán AI + % tin cậy',
    'Báo cáo giấc ngủ đầy đủ',
    'Xuất dữ liệu (CSV/JSON)',
  ] as string[],

  // Duration suggestion reasons
  suggestion_reason_science: 'Mặc định khoa học',
  suggestion_reason_time_of_day: 'Gợi ý cho thời điểm này trong ngày',

  // Alarm notification
  alarm_notification_title: 'Đã đến giờ thức dậy!',
  alarm_notification_body: (minutes: number) => `Giấc ngủ ${minutes} phút của bạn đã kết thúc.`,

  // Paywall navigation reasons
  paywall_reason_export: 'Xuất dữ liệu yêu cầu gói Max',
  paywall_reason_sound: (sound: string) => `Âm thanh ${sound} yêu cầu gói trả phí`,
  paywall_reason_ai: 'Nâng cấp Pro để dùng dự đoán AI',
  paywall_reason_placements: 'Nâng cấp Pro để kết hợp vị trí đặt máy',
  paywall_header_brand: 'Sleep Luxe',
  paywall_hero_unlock: 'Mở khoá',
  paywall_hero_sub: 'Chọn gói phù hợp với nhu cầu ngủ của bạn và tối ưu giấc nghỉ.',
  paywall_free_tier_name: 'MIỄN PHÍ',
  paywall_free_downgrade_label: 'Gói miễn phí',

  // Max fall-asleep time picker (Feature 1 + 2)
  home_fall_asleep_limit_label: 'Thời gian tối đa để ngủ',
  home_fall_asleep_limit_hint: 'Báo thức vang lên nếu bạn vẫn thức sau thời gian này',
  home_ai_fall_asleep_suggest: (min: number) =>
    `AI gợi ý: ~${min} phút dựa trên lịch sử của bạn`,

  // Wake — fall-asleep timeout (Feature 1)
  wake_fall_asleep_timeout_title: 'Hết thời gian ngủ',
  wake_fall_asleep_timeout_body:
    'Thời gian để bắt đầu ngủ đã kết thúc. Báo thức vang lên vì bạn vẫn còn thức.',

  // Onboarding — new pages (Feature 3)
  onboarding_fallasleep_title: 'Đặt giới hạn thời gian ngủ',
  onboarding_fallasleep_body:
    'Chọn thời gian tối đa để bạn ngủ. Nếu bạn vẫn thức sau thời gian đó, báo thức sẽ vang lên ngay để bạn không bỏ lỡ khoảng thời gian nghỉ.',
  onboarding_ai_title: 'AI học từ mỗi lần chợp mắt',
  onboarding_ai_body:
    'Sau 5 lần chợp mắt, AI dự đoán thời gian bạn cần để ngủ ở các thời điểm khác nhau — và gợi ý giới hạn thời gian ngủ hoàn hảo cho bạn.',

  // Custom alarm sounds
  settings_custom_sounds: 'Âm thanh báo thức tuỳ chỉnh',
  settings_add_custom_sound: 'Thêm từ thiết bị',
  settings_custom_sound_delete_confirm_title: 'Xoá âm thanh',
  settings_custom_sound_delete_confirm_body: (name: string) => `Xoá "${name}" khỏi âm thanh tuỳ chỉnh?`,
  settings_custom_sound_delete: 'Xoá',
  settings_custom_sound_pick_error_title: 'Không thể thêm âm thanh',
  settings_custom_sound_pick_error: 'Không thể nhập tệp đã chọn.',

  // Common
  common_preview: 'Xem trước',
  common_cancel: 'Huỷ',
  common_ok: 'OK',
  common_minutes_short: 'phút',

  // Guide screen
  guide_title: 'Hướng dẫn trải nghiệm tốt nhất',
  guide_intro_pre: 'Smart Nap Timer sử dụng',
  guide_intro_sensors: 'gia tốc kế, con quay hồi chuyển và micrô',
  guide_intro_post: 'của điện thoại để phát hiện khi bạn ngủ — không cần thiết bị đeo. Làm theo hướng dẫn này để đạt độ chính xác cao nhất.',
  guide_section_placements: 'Chọn vị trí đặt máy',
  guide_section_confidence: 'Hiểu về điểm tin cậy',
  guide_section_min_time: 'Thời gian phát hiện tối thiểu',
  guide_section_environment: 'Mẹo về môi trường',
  guide_section_ai: 'AI học như thế nào',
  guide_placement_hand_best: 'Ghế văn phòng, xe buýt, máy bay',
  guide_placement_hand_step1: 'Để tay xuống cạnh người với điện thoại cầm nhẹ trong lòng bàn tay.',
  guide_placement_hand_step2: 'Khi bạn thiếp đi, tay tự nhiên buông lỏng — đây là tín hiệu kích hoạt phát hiện.',
  guide_placement_hand_step3: 'Khi độ tin cậy đạt ~65%, nhẹ nhàng đặt điện thoại lên ngực hoặc đệm.',
  guide_placement_hand_step4: 'Phát hiện tiếp tục tự động. Điện thoại có thể ở bất cứ đâu trong phần còn lại của giấc ngủ.',
  guide_placement_hand_warning: 'Không lý tưởng cho giấc ngủ trên giường — cầm điện thoại khi nằm rất không thoải mái.',
  guide_placement_chest_best: 'Giường, ghế sofa, ghế ngả',
  guide_placement_chest_step1: 'Nằm ngửa và đặt điện thoại ngửa lên trên ngực.',
  guide_placement_chest_step2: 'Micrô thu nhịp thở của bạn trực tiếp qua rung động từ ngực.',
  guide_placement_chest_step3: 'Giữ phòng yên tĩnh — TV hoặc nhạc to sẽ làm nhiễu micrô.',
  guide_placement_chest_step4: 'Không cần cầm — cứ để điện thoại nằm tự nhiên.',
  guide_placement_mattress_best: 'Giường (nằm nghiêng)',
  guide_placement_mattress_step1: 'Đặt điện thoại úp xuống trên đệm cạnh hông.',
  guide_placement_mattress_step2: 'Không cầm — đệm hấp thụ chuyển động, nên sự bất động là tín hiệu chính.',
  guide_placement_mattress_step3: 'Phòng yên tĩnh quan trọng hơn ở vị trí này so với bất kỳ vị trí nào khác.',
  guide_placement_mattress_step4: 'Phát hiện cần thêm thời gian (tối thiểu 5 phút) vì tín hiệu chuyển động yếu.',
  guide_placement_mattress_warning: 'Cần micrô để phát hiện nhịp thở. Hoạt động kém trong phòng ồn.',
  guide_placement_pocket_best: 'Chỉ dùng khi không còn lựa chọn',
  guide_placement_pocket_step1: 'Bỏ điện thoại vào túi hoặc đặt úp xuống trên bàn đầu giường.',
  guide_placement_pocket_step2: 'Gần như chỉ dựa vào thời gian bạn nằm yên.',
  guide_placement_pocket_step3: 'Độ chính xác thấp hơn — micrô bị che và tín hiệu chuyển động tối thiểu.',
  guide_placement_pocket_warning: 'Kém chính xác nhất. Dùng Tay hoặc Ngực để phát hiện tốt hơn.',
  guide_conf_body: 'Điểm tin cậy (0–100%) kết hợp tín hiệu từ tất cả cảm biến. Phát hiện kích hoạt khi điểm ở trên 80% liên tục 6 giây, không có xu hướng giảm.',
  guide_conf_awake_label: 'Thức',
  guide_conf_awake_desc: 'Phát hiện chuyển động hoặc tiếng ồn. Hãy nằm yên và im lặng.',
  guide_conf_drowsy_label: 'Buồn ngủ',
  guide_conf_drowsy_desc: 'Tín hiệu đang cải thiện. Tiếp tục nằm yên — bạn đang thiếp đi.',
  guide_conf_almost_label: 'Sắp được rồi',
  guide_conf_almost_desc: 'Tín hiệu giấc ngủ mạnh. Phát hiện có thể kích hoạt sớm.',
  guide_conf_detected_label: 'Đã phát hiện',
  guide_conf_detected_desc: 'Duy trì 6 giây → xác nhận ngủ. Bộ đếm thời gian bắt đầu.',
  guide_conf_guard_pre: 'Một',
  guide_conf_guard_highlight: 'bộ lọc dương tính giả',
  guide_conf_guard_post: 'ngăn điểm đạt 80% trừ khi cả cảm biến chuyển động và nhịp thở đều đồng ý — nên chỉ nằm yên thôi là chưa đủ.',
  guide_time_body: 'Ứng dụng đặt thời gian chờ tối thiểu trước khi phát hiện có thể kích hoạt. Điều này ngăn dương tính giả khi bạn chỉ vừa nằm xuống.',
  guide_time_hand_time: '3,5 phút',
  guide_time_hand_note: 'Buông lỏng tay là tín hiệu nhanh và rõ ràng',
  guide_time_chest_time: '4 phút',
  guide_time_chest_note: 'Nhịp thở cần thời gian để ổn định',
  guide_time_mattress_time: '5 phút',
  guide_time_mattress_note: 'Cảm biến chuyển động không nhạy — micrô cần thêm thời gian',
  guide_time_pocket_time: '5 phút',
  guide_time_pocket_note: 'Tín hiệu yếu nhất',
  guide_time_movement_body: 'Chuyển động sau khi bộ đếm bắt đầu sẽ thêm 90 giây vào thời gian tối thiểu — bộ đếm sẽ đặt lại một phần và bạn cần nằm yên đủ lâu sau khi ổn định.',
  guide_env_quiet: 'Phòng yên tĩnh là yếu tố #1. Tắt TV và đặt điện thoại ở chế độ im lặng trước khi bắt đầu.',
  guide_env_cool: 'Phòng mát (18–22°C) giúp bạn ngủ nhanh hơn và cải thiện độ chính xác phát hiện.',
  guide_env_dark: 'Giảm hoặc tắt đèn. Ánh sáng ức chế melatonin và trì hoãn giấc ngủ.',
  guide_env_schedule: 'Chợp mắt vào cùng một giờ mỗi ngày. Cơ thể thích nghi và AI học nhịp sinh học của bạn.',
  guide_env_rate: 'Đánh giá mỗi lần chợp mắt sau khi thức dậy. AI dùng đánh giá của bạn để dự đoán độ trễ giấc ngủ tốt hơn.',
  guide_env_ai: 'AI kích hoạt sau 5 lần đánh giá và cải thiện theo từng lần chợp mắt bạn ghi lại.',
  guide_ai_step_nap: 'Chợp mắt',
  guide_ai_step_rate: 'Đánh giá',
  guide_ai_step_sessions: 'Phiên',
  guide_ai_step_active: 'AI hoạt động',
  guide_ai_body1_pre: 'Sau 5 lần đánh giá, AI kích hoạt và dự đoán độ trễ giấc ngủ cá nhân của bạn dựa trên',
  guide_ai_body1_highlight: 'thời điểm trong ngày, ngày trong tuần, phiên trước và đánh giá lúc thức',
  guide_ai_body1_post: '. AI gợi ý thời lượng chợp mắt tốt nhất và điều chỉnh ngưỡng phát hiện theo thói quen ngủ của bạn.',
  guide_ai_body2: 'Bạn đánh giá càng nhiều, dự đoán càng chính xác. Luôn nhấn đánh giá sao trên màn hình Thức dậy — dù chỉ nhấn nhanh cũng giúp ích.',

  // Settings — Help section
  settings_section_help: 'Trợ giúp',
  settings_guide_btn: 'Hướng dẫn trải nghiệm tốt nhất',
};

// ─────────────────────────────────────────
// Locale Detection / Exports
// ─────────────────────────────────────────

// ── Locale detection + export ──────────────────────────────────────────────
function isVietnamese(): boolean {
  return Intl.DateTimeFormat().resolvedOptions().locale.startsWith('vi');
}

// Single object used by all screens -- auto-selects language at module load
export const Strings = isVietnamese() ? VI : EN;

// Hook for screens that need the strings object (same result, React-friendly)
export function useStrings() {
  return Strings;
}

// ─────────────────────────────────────────
// Types / Interfaces
// ─────────────────────────────────────────

export type StringsType = typeof EN;
